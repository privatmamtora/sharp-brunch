'use strict';

var sharp = require('sharp');
var path = require('path');
var fs = require('fs');
var _ = require('lodash');
var mkdirp = require("mkdirp");
var anymatch = require('anymatch');
var glob = require('glob');

// Default marker.  Can be configured via `plugins.gitSHA.marker`.
var PLUGIN_NAME = 'sharp-brunch';

//Sharp.prototype.retinaRe = /(@2[xX])\.(?:gif|jpeg|jpg|png)$/;

Sharp.prototype.defaultOptions = {
    crop : '', // Possible values are north, east, south, west, center.
    max : false, //false will be ignored
    embedWhite : false, //false will be ignored
    embedBlack : false, //false will be ignored
    rotate : false, //false will be ignored. true will use value from EXIF Orientation tag. Or a number 0, 90, 180 or 270
    withoutEnlargement : true,
    sharpen : false,
    interpolateWith : '', // [nearest, bilinear, bicubic, vertexSplitQuadraticBasisSpline, locallyBoundedBicubic, nohalo]
    gamma : false, // if present, is a Number betweem 1 and 3. The default value is 2.2, a suitable approximation for sRGB images.
    grayscale : false,
    output : '', // string of extension without dot ('.'). either ["jpeg", "png", "webp"]
    quality : false, // only applies JPEG, WebP and TIFF
    progressive : false,
    withMetadata : false,
    compressionLevel : false // only apply to png
};

function Sharp(config) {
    var cfg,
        self = this,
        shConfig = {
            src: 'public/images',
            dest: 'public/images/min',
            imageExt: ["png",
                "tiff", "tif",
                "webp",
                "jpeg", "jpg", "jpe", "jif", "jfif", "jfi"],
            imageNot: ["gif",
                "bmp", "dib"],
            "imageOutput": ["jpeg", "png", "webp", "raw"]
        },
        schema = {
            src: {
                doc: "",
                format: "",
                default: "public/images"
            }
        };

    if (config && config.plugins && config.plugins.sharp) {
        cfg = config.plugins.sharp;
    } else {
        cfg = {};
    }

    var opt = _.defaultsDeep({}, cfg, shConfig);
    opt.options = _.defaultsDeep({}, opt.options, this.defaultOptions);
    this.options = opt;

}

// Tell Brunch we are indeed a plugin for it
Sharp.prototype.brunchPlugin = true;

// On-the-fly compilation callback (file by file); assumes Brunch already
// accepted that file for our plugin by checking `type`, `extension` and
// `pattern`.
Sharp.prototype.onCompile = function(generatedFiles) {
    var cfg = this.options;

    if (!this.validateConfig()) return;

    this.imageExtMatcher = anymatch(buildExtPattern(this.options.imageExt));

    var imageFiles;

    imageFiles = this.fetchFiles();
    if (imageFiles.length > 0) {
        //console.log("\n\nSharp Options (C)" + JSON.stringify(imageFiles, null, '\t') + " (" + imageFiles.length + ")");
        var pipeline = this.createSharpPipeline(cfg.options);

        _.map(imageFiles, function (file) {
            var buf = pipeline(file);
            buf.then(function (outputBuffer) {
                //console.log("Image (C)" + JSON.stringify(this.destFile(file)) + " (Success)");
                writeFile(this.destFile(file), outputBuffer, function (error) {
                    console.error(PLUGIN_NAME + ": " + error.message);
                });
            }.bind(this));
        }.bind(this));
    }
        //var stream = es.map(function(imageFiles, callback) {
        ////return es.map(function(file, callback)
        //    pipeline(file).then(
        //        function(outputBuffer){ // onFulfilled
        //            //fs.writeFileSync('', 'Hello Node', function (err) {
        //            //    if (err) throw err;
        //            //    console.log('It\'s saved!');
        //            //});
        //
        //            //if (mergedOptions.output) {
        //            //    // change file extension
        //            //    newFile.path = replaceExt(newFile.path, '.' + mergedOptions.output);
        //            //}
        //
        //            callback(null, newFile);
        //        },
        //        function(error){ // onRejected
        //            callback(error);
        //        }
        //    );
        //});

        // returning the file stream
        //return stream;
        //return _results;

    else {
        //console.log(PLUGIN_NAME + " Nothing to process");
    }

};

Sharp.prototype.validateConfig = function(callback) {
    if ( this.options === undefined ) {
        return console.error(PLUGIN_NAME + ': Missing options object');
        return false;
    } else if ( ! _.isPlainObject(this.options.options) ) {
        return console.error(PLUGIN_NAME + ': options object must be plain object (created with `{}` literal) ');
        return false;
    } else if ( this.options.options.resize === undefined && this.options.options.extract === undefined ) {
        return console.error(PLUGIN_NAME + ': Please specify an extract or resize property in your options object');
        return false;
    } else if ( this.options.options.resize && Array.isArray( this.options.options.resize ) === false ) {
        return console.error(PLUGIN_NAME + ': options.resize must be array');
        return false;
    }

    if (!this.options.imageExt || this.options.imageExt.constructor !== Array) {
        return console.error(PLUGIN_NAME + ': The option \'imageExt\' must be an array');
        return false;
    }

    return true;
};

Sharp.prototype.fetchFiles = function() {
    // Allow consumer to control options
    return glob.sync(this.options.src + "/**/*", {nodir: true, ignore: this.options.dest + "/**/*"}).filter(this.imageExtMatcher);
};

var buildExtPattern = function(extList) {
    return new RegExp('\.(' + extList.join("|") + ')$');
};

var replaceExt = function (pathStr, ext) {
    return path.join(
        path.dirname(pathStr),
        path.basename(pathStr, path.extname(pathStr)) + ext);
};

Sharp.prototype.destFile = function (file) {

    var nest = path.relative(this.options.src, path.dirname(file));
    //console.log("Src: " + nest);
    return path.join(this.options.dest, nest, path.basename(file));
};

var writeFile = function (filePath, contents, callback) {
    //mkdirp(path.dirname(filePath), function (error) {
    //    if (error) return callback(error);
    //    fs.writeFileSync(filePath, contents, cb);
    //})

    try {
        mkdirp.sync(path.dirname(filePath)); // Need to make async
        fs.writeFileSync(filePath, contents);
    } catch (error) {
        return callback(error);
    }
};

var execute = function ( obj, task ) {

    var methodName = task[0];
    var passedValue = task[1];

    if (_.isArray(passedValue)) {
        return obj[ methodName ].apply(this, passedValue); // `this` will be binded later at runtime
    }

    return obj[ methodName ]( passedValue );
};

Sharp.prototype.getRotate = function( val ){
    if (_.isBoolean(val) && val === false) {
        return false;
    } else if (_.isBoolean(val) && val === true) {
        return ['rotate', undefined];
    } else {
        return ['rotate', val];
    }
};

Sharp.prototype.createSharpPipeline = function( opts ) {
    // create pipeline manually to preserve consistency
    var pipeline = [
        (opts.resize) ? ['resize', opts.resize] : undefined,
        (opts.withoutEnlargement) ? ['withoutEnlargement', undefined] : undefined,
        (opts.max) ? ['max', undefined] : undefined,
        (opts.crop) ? ['crop', sharp.gravity[opts.crop] ] : undefined,
        (opts.interpolateWith) ? ['interpolateWith', sharp.interpolator[opts.interpolateWith] ] : undefined,
        (opts.embedWhite) ? ['embedWhite', undefined] : undefined,
        (opts.embedBlack) ? ['embedBlack', undefined] : undefined,

        // rotate is special case, the value will be get with getRotate() function
        // because short-circuiting possible value 0 with undefined (which is get from EXIF) is impossible
        (this.getRotate(opts.rotate)) ? this.getRotate(opts.rotate) : undefined,
        (opts.extract) ? ['extract', [opts.extract.topOffset, opts.extract.leftOffset, opts.extract.width, opts.extract.height]] : undefined,
        (opts.sharpen) ? ['sharpen', undefined ] : undefined,
        (opts.gamma) ? ['gamma', opts.gamma ] : undefined,
        (opts.grayscale) ? ['grayscale', undefined] : undefined,
        (opts.withMetadata) ? ['withMetadata', undefined] : undefined,
        (opts.quality) ? ['quality', opts.quality] : undefined,
        (opts.progressive) ? ['progressive', undefined] : undefined,
        (opts.compressionLevel) ? ['compressionLevel', opts.compressionLevel] : undefined
    ];

    // remove task that is undefined
    pipeline = _.compact(pipeline);
    //console.log("\n\nPipeline Options (C)" + JSON.stringify(pipeline, null, '\t') + " (" + ")");

    return function( file ){

        //var promises = null;
        var input = null;

        //if (file.isNull()) {
            input = sharp(file).sequentialRead(); // because dirname...
        //} else {
        //    input = sharp(file.contents).sequentialRead();
        //}
        var executeInstance = execute.bind(input);

        var transform = _.reduce( pipeline, function(accumulator, task){
            return executeInstance(accumulator, task);
        }, input);

        if (opts.output) {
            console.log("\n\nOputput (C)" + " (" + ")");
            transform = transform[opts.output]();
        }

        //promises = transform.toBuffer();
        //return promises;
        return transform.toBuffer();
    };
};

// Helper: escapes any regex-special character
function escapeRegex(str) {
    return String(str).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// The plugin has to be the module’s default export
module.exports = Sharp;
