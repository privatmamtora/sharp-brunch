'use strict';

var sharp = require('sharp');
var path = require('path');
var fs = require('fs');
var _ = require('lodash');
var mkdirp = require("mkdirp");
var anymatch = require('anymatch');
var glob = require('glob');
var chalk = require('chalk');
var async = require('async');

// Default marker.  Can be configured via `plugins.gitSHA.marker`.
var PLUGIN_NAME = 'sharp-brunch';

//Sharp.prototype.retinaRe = /(@2[xX])\.(?:gif|jpeg|jpg|png)$/;

Sharp.prototype.defaultOptions = {
    resize: '', // Array of [width, height], [width], or [null, height]
    crop: '', // Possible values are north, east, south, west, center.
    embed: false, // Preserve aspect ratio, resize to max width or height, then embed on `background`
    max : false, // Preserve aspect ratio, and try to make as big as possible but <= `resize`
    min: false, // Preserve aspect ratio, and try to make as small as possible but >= `resize`
    withoutEnlargement : true, // Will ignore resize if it larger than image
    ignoreAspectRatio: false,
    interpolateWith : '', // [nearest, bilinear, bicubic, vertexSplitQuadraticBasisSpline, locallyBoundedBicubic, nohalo]
    extract: false,

    rotate : false, //false will be ignored. true will use value from EXIF Orientation tag. Or a number 0, 90, 180 or 270
    sharpen : false,
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
    //console.log("Options (I)" + JSON.stringify(cfg, null, '\t'));

    var opt = _.defaultsDeep({}, cfg, shConfig);
    //opt.options = _.defaultsDeep({}, opt.options, this.defaultOptions);
    opt.options = _.defaultsDeep({}, opt.options);
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

        //modifyImages(imageFiles, cfg.options, function (err) {
        //    if (err) {
        //        console.log("Error: " + err.message);
        //    }
        //});
    //    //console.log("\n\nSharp Options (C)" + JSON.stringify(imageFiles, null, '\t') + " (" + imageFiles.length + ")");
    //    var pipeline = this.createSharpPipeline(cfg.options);
        var pip = this.createPipe(cfg.options);
        //console.log("Pipe: " + pip);

        _.map(imageFiles, function (file) {
            var ro = sharp().rotate(90);
            var re = sharp().resize(1200).on('error', function(err) {
                console.log(err);
            });
            var test1 = sharp().jpeg().trellisQuantisation();

            var trans = sharp();

            _.forEach(pip, function(n, key) {
                console.log(JSON.stringify(n, null, '\t'));
                //if (n[0] == "resize") {
                //    //trans = trans.resize(n[1]);
                //}
                //
                //if (n[0] == "rotate") {
                //    trans = trans.rotate(n[1]);
                //}

                //_.map(n, function (args, op) {
                //    console.log("Option: " + args + "," + op);
                    if (trans[n[0]]) {
                        //data[op].apply(data, [].concat(args));
                        trans[n[0]].apply(trans, [].concat(n[1]));

                        if(n[0] == 'toFormat') {
                            file.dest = replaceExt(file.dest, '.' + n[1].id);
                        }
                    }
                    else if (n[0] !== 'rename') {
                        console.log('Skipping unknown operation: ' + n[0]);
                    }
                //});
            });

            //console.log(sharp(file.src).pipe(trans));
            sharp(file.src).pipe(trans).toBuffer().then(function (data) {
                //var dest = destFile(file.src, cfg.src, cfg.dest);
                console.log("Image (C)" + JSON.stringify(file.dest) + " (Success)");
                writeFile(file.dest, data, function (error) {
                        console.error(PLUGIN_NAME + ": " + error.message);
                    });
            });

            //var buf = pipeline(file.src);
            //buf.then(function (outputBuffer) {
            //    console.log("Image (C)" + JSON.stringify(this.destFile(file.src, cfg.src, cfg.dest)) + " (Success)");
            //    writeFile(this.destFile(file.src, cfg.src, cfg.dest), outputBuffer, function (error) {
            //        console.error(PLUGIN_NAME + ": " + error.message);
            //    });
            //}.bind(this));
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

var modifyImages = function (images, options, done) {
    var tasks = _.map(images, function (image) {
        return function (callback) {
            modifyImage(image, options, callback);
        };
    });

    async.parallel(tasks, function (err, results) {
        if (err) {

            return done(new Error(err));
        }

        var total = results.reduce(function (memo, result) {
            return memo + result.length;
        }, 0);

        console.log('Generated ' + chalk.styles.cyan(total.toString()) + (total === 1 ? ' image' : ' images'));

        done();
    });
};

var modifyImage = function (image, options, done) {
    var tasks = _.map(options.tasks || [options], function (task) {
        return function (callback) {
            var data = sharp(image.src);

            _.map(task, function (args, op) {
                console.log("Option: " + args + "," + op);
                if (data[op]) {
                    data[op].apply(data, [].concat(args));
                }
                else if (op !== 'rename') {
                    console.log('Skipping unknown operation: ' + op);
                }
            });

            console.log("Done: " + image.dest);
            writeImage(data, image, task.rename, callback);
            //writeFile(image.dest, data.toBuffer(), function (error) {
            //    console.error(PLUGIN_NAME + ": " + error.message);
            //});
        };
    });
    console.log("Option: " + tasks);
    async.parallel(tasks, function (err, result) {
        console.log("Err: " + err.message + " , Res" + result);
        if (err) {
            return done(new Error(err));
        }
        done(null, result);
    });
};

Sharp.prototype.validateConfig = function(callback) {
    if ( this.options === undefined ) {
        return console.error(PLUGIN_NAME + ': Missing options object');
    } else if ( ! _.isPlainObject(this.options.options) ) {
        return console.error(PLUGIN_NAME + ': options object must be plain object (created with `{}` literal) ');
    } //else if ( this.options.options.resize === undefined && this.options.options.extract === undefined ) {
    //    return console.error(PLUGIN_NAME + ': Please specify an extract or resize property in your options object');
    //} else if ( this.options.options.resize && Array.isArray( this.options.options.resize ) === false ) {
    //    return console.error(PLUGIN_NAME + ': options.resize must be array');
    //}

    if (!this.options.imageExt || this.options.imageExt.constructor !== Array) {
        return console.error(PLUGIN_NAME + ': The option \'imageExt\' must be an array');
    }

    return true;
};

Sharp.prototype.fetchFiles = function() {
    // Need to allow consumer to control options
    // TODO: Update to aloow full glob pattern support

    var files = glob.sync(this.options.src + "/**/*", {nodir: true, ignore: this.options.dest + "/**/*"}).filter(this.imageExtMatcher);
    return _.map(files, function (file) {
       return {src: file, ext: path.extname(file), dest: this.destFile(file, this.options.src, this.options.dest)};
    }, this);
};

var buildExtPattern = function(extList) {
    return new RegExp('\.(' + extList.join("|") + ')$');
};

var replaceExt = function (pathStr, ext) {
    return path.join(
        path.dirname(pathStr),
        path.basename(pathStr, path.extname(pathStr)) + ext);
};

var destFile = function (file, src, dest) {

    var nest = path.relative(src, path.dirname(file));
    //console.log("Src: " + nest);
    return path.join(dest, nest, path.basename(file));
};

Sharp.prototype.destFile = destFile;
//Sharp.prototype.destFile = function (file, src, dest) {
//
//    var nest = path.relative(src, path.dirname(file));
//    //console.log("Src: " + nest);
//    return path.join(dest, nest, path.basename(file));
//};

var writeFile = function (filePath, contents, callback) {
    //mkdirp(path.dirname(filePath), function (error) {
    //    if (error) return callback(error);
    //    fs.writeFileSync(filePath, contents, cb);
    //})

    try {
        mkdirp(path.dirname(filePath)); // Need to make async
        fs.writeFile(filePath, contents, callback);
    } catch (error) {
        return callback(error);
    }
};

var writeImage = function (data, image, rename, callback) {
    var src = image.src;
    var ext = image.ext;
    var dest = image.dest;
    var dir = path.dirname(dest);
    var base = path.basename(dest, ext);

    //grunt.file.mkdir(dir);
    mkdirp.sync(dir);
    //dest = rename ? path.join(dir, processName(rename, {base: base, ext: ext.substr(1)})) : dest;

    data.toFile(dest, function (err, info) {
        //console.log("Err: " + err.message + " , Info" + info);
        if (err) {
            return callback(err);
        }

        console.log('Images: ' + chalk.styles.cyan(src) + ' -> ' + chalk.styles.cyan(dest));
        //console.log('Images: ' + chalk.styles.cyan(dest));
        callback(null, info);
    });
};

var getRotate = function( val ){
    if (_.isBoolean(val) && val === false) {
        return false;
    } else if (_.isBoolean(val) && val === true) {
        return ['rotate', undefined];
    } else {
        return ['rotate', val];
    }
};

var getTask = function(property, val) {
    if (_.isBoolean(val) && val === false) {
        return false;
    } else if (_.isBoolean(val) && val === true) {
        return [property, undefined];
    } else {
        return [property, val];
    }
};

Sharp.prototype.createPipe = function (opts) {
    var p = [];
    _.forOwn(opts, function(value, key) {
        //console.log(key + "," + JSON.stringify(value, null, '\t'));
        //console.log(Object.keys(value)[0]);
        if (value.resize) {
            p.push(getTask('resize', value.resize))
        } else if (value.crop) {
            p.push(getTask('crop', sharp.gravity[value.crop]));
        } else if (value.embed) {
            p.push(getTask('embed', value.embed));
        } else if (value.max) {
            p.push(getTask('max', value.max));
        } else if (value.min) {
            p.push(getTask('min', value.min));
        } else if (value.withoutEnlargement) {
            p.push(getTask('withoutEnlargement', value.withoutEnlargement));
        } else if (value.ignoreAspectRatio) {
            p.push(getTask('ignoreAspectRatio', value.ignoreAspectRatio));
        } else if (value.interpolateWith) {
            p.push(getTask('interpolateWith', sharp.interpolator[value.interpolateWith]));
        } else if (value.extract) {
            p.push(getTask('extract', [value.extract.top, value.extract.left, value.extract.width, value.extract.height]));
        } else if (value.background) {
            p.push(getTask('background', value.background));
        } else if (value.flatten) {
            p.push(getTask('flatten', value.flatten));
        } else if (value.rotate) {
            p.push(getTask('rotate', value.rotate));
        } else if (value.flip) {
            p.push(getTask('flip', value.flip));
        } else if (value.flop) {
            p.push(getTask('flop', value.flop));
        } else if (value.blur) {
            p.push(getTask('blur', value.blur));
        } else if (value.sharpen) {
            p.push(getTask('sharpen', value.sharpen));
        } else if (value.gamma) {
            p.push(getTask('gamma', value.gamma));
        } else if (value.greyscale || value.grayscale) {
            p.push(getTask('greyscale', value.greyscale || value.grayscale));
        } else if (value.normalize || value.normalise) {
            p.push(getTask('normalize', value.normalize || value.normalise));
        } else if (value.overlayWith) {
            p.push(getTask('overlayWith', value.overlayWith));
        } else if (value.toFormat) {
            p.push(getTask('toFormat', sharp.format[value.toFormat]));
        } else if (value.quality) {
            p.push(getTask('quality', value.quality));
        } else if (value.progressive) {
            p.push(getTask('progressive', value.progressive));
        } else if (value.withMetadata) {
            p.push(getTask('withMetadata', value.withMetadata));
        } else if (value.withoutChromaSubsampling) {
            p.push(getTask('withoutChromaSubsampling', value.withoutChromaSubsampling));
        } else if (value.compressionLevel) {
            p.push(getTask('compressionLevel', value.compressionLevel));
        } else if (value.withoutAdaptiveFiltering) {
            p.push(getTask('withoutAdaptiveFiltering', value.withoutAdaptiveFiltering));
        } else if (value.trellisQuantisation || value.trellisQuantization) {
            p.push(getTask('trellisQuantisation', value.trellisQuantisation || value.trellisQuantization));
        } else if (value.overshootDeringing) {
            p.push(getTask('overshootDeringing', value.overshootDeringing));
        } else if (value.optimiseScans || value.optimizeScans) {
            p.push(getTask('optimiseScans', value.optimiseScans || value.optimizeScans));
        } else {
            //p.push(getTask());
        }



    });

    p.push(false);
    console.log(p);
    p = _.compact(p);
    console.log(p);
    return p;
};

Sharp.prototype.createSharpPipeline = function( opts ) {
    // create pipeline manually to preserve consistency
    var pipeline = [
        (opts.resize) ? ['resize', opts.resize] : undefined,
        (opts.crop) ? ['crop', sharp.gravity[opts.crop] ] : undefined,
        (opts.embed) ? ['embed', undefined] : undefined,
        (opts.background) ? ['background', opts.background] : undefined,
        (opts.max) ? ['max', undefined] : undefined,
        (opts.min) ? ['min', undefined] : undefined,
        (opts.withoutEnlargement) ? ['withoutEnlargement', undefined] : undefined,
        (opts.ignoreAspectRatio) ? ['ignoreAspectRatio', undefined] : undefined,
        (opts.interpolateWith) ? ['interpolateWith', sharp.interpolator[opts.interpolateWith] ] : undefined,
        (opts.extract) ? ['extract', [opts.extract.top, opts.extract.left, opts.extract.width, opts.extract.height]] : undefined,

        // rotate is special case, the value will be get with getRotate() function
        // because short-circuiting possible value 0 with undefined (which is get from EXIF) is impossible
        (getRotate(opts.rotate)) ? getRotate(opts.rotate) : undefined,
        (opts.sharpen) ? ['sharpen', undefined ] : undefined,
        (opts.gamma) ? ['gamma', opts.gamma ] : undefined,
        (opts.grayscale) ? ['grayscale', undefined] : undefined,
        (opts.withMetadata) ? ['withMetadata', undefined] : undefined,
        (opts.quality) ? ['quality', opts.quality] : undefined,
        (opts.progressive) ? ['progressive', undefined] : undefined,
        (opts.compressionLevel) ? ['compressionLevel', opts.compressionLevel] : undefined
    ];

    var p = [];
    _.forOwn(opts, function(value, key) {
        //console.log(key + "," + JSON.stringify(value, null, '\t'));
        //console.log(Object.keys(value)[0]);

        (value.resize) ? p.push(getTask('resize', value.resize)) : undefined;
        (value.crop) ? p.push(getTask('crop', sharp.gravity[value.crop])) : undefined;
        (value.embed) ? p.push(getTask('embed', undefined)) : undefined;
        (value.background) ? p.push(getTask('background', value.background)) : undefined;
        (value.max) ? p.push(getTask('max', undefined)) : undefined;
        (value.min) ? p.push(getTask('min', undefined)) : undefined;
        (value.withoutEnlargement) ? p.push(getTask('withoutEnlargement', undefined)) : undefined;
        (value.ignoreAspectRatio) ? p.push(getTask('ignoreAspectRatio', undefined)) : undefined;
        (value.interpolateWith) ? p.push(getTask('interpolateWith', sharp.interpolator[opts.interpolateWith])) : undefined;
        (value.extract) ? p.push(getTask('extract', [value.extract.top, value.extract.left, value.extract.width, value.extract.height])) : undefined;

        //// rotate is special case, the value will be get with getRotate() function
        //// because short-circuiting possible value 0 with undefined (which is get from EXIF) is impossible
        (value.rotate) ? p.push(getTask('rotate', value.rotate)) : undefined;
        //(opts.sharpen) ? ['sharpen', undefined ] : undefined,
        //(opts.gamma) ? ['gamma', opts.gamma ] : undefined,
        //(opts.grayscale) ? ['grayscale', undefined] : undefined,
        //(opts.withMetadata) ? ['withMetadata', undefined] : undefined,
        //(opts.quality) ? ['quality', opts.quality] : undefined,
        //(opts.progressive) ? ['progressive', undefined] : undefined,
        //(opts.compressionLevel) ? ['compressionLevel', opts.compressionLevel] : undefined
    });

    //p = _.reduce(opts, function(result, item) {
    //    console.log(result);
    //    if(item.resize) {
    //        result.push(['resize', item.resize]);
    //    }
    //});

    // remove task that is undefined
    pipeline = _.compact(pipeline);
    p = _.compact(p);
    //console.log("Options Options (C)" + JSON.stringify(opts, null, '\t'));
    //console.log("P Options (C)" + JSON.stringify(p, null, '\t') + "," + p.length);
    //console.log("Pipeline Options (C)" + JSON.stringify(pipeline, null, '\t'));

    return function( file ){

        //var promises = null;
        var input = null;

        //if (file.isNull()) {
            input = sharp(file).sequentialRead(); // because dirname...
        //} else {
        //    input = sharp(file.contents).sequentialRead();
        //}
        var executeInstance = execute.bind(input);

        var transform = _.reduce( p, function(accumulator, task){
            //return executeInstance(accumulator, task);

            var methodName = task[0];
            var passedValue = task[1];

            //if (_.isArray(passedValue)) {
            console.log("Task ("+ methodName +")" + JSON.stringify(passedValue, null, '\t'));
            return accumulator[methodName].apply(input, [].concat(passedValue)); // `this` will be binded later at runtime
            //return accumulator[methodName](passedValue); // `this` will be binded later at runtime
        }, input);

        var ref = new Reflector(transform);

        //console.log(input.);
        //console.log(ref.getAllMethods());
        //console.log(transform.options);

        if (opts.output) {
            console.log("\n\nOputput (C)" + " (" + ")");
            transform = transform[opts.output]();
        }

        //promises = transform.toBuffer();
        //return promises;
        return transform.toBuffer();
    };
};

var Reflector = function(obj) {
    this.getProperties = function() {
        var properties = [];
        for (var prop in obj) {
            if (typeof obj[prop] != 'function') {
                properties.push(prop);
            }
        }
        return properties;

    };

    this.getAllMethods = function() {
        var methods = [];
        for (var method in obj) {
            if (typeof obj[method] == 'function') {
                methods.push(method);
            }
        }
        return methods;
    };

    this.getOwnMethods = function() {
        var methods = [];
        for (var method in obj) {
            if (  typeof obj[method] == 'function'
                && obj.hasOwnProperty(method)) {
                methods.push(method);
            }
        }
        return methods;
    };
};

var execute = function ( obj, task ) {

    var methodName = task[0];
    var passedValue = task[1];

    //if (_.isArray(passedValue)) {
        console.log("Task ("+ methodName +")" + JSON.stringify(passedValue, null, '\t'));
        return obj[methodName].apply(this, [].concat(passedValue)); // `this` will be binded later at runtime
    //}

    //return obj[ methodName ]( passedValue );
};

// Helper: escapes any regex-special character
function escapeRegex(str) {
    return String(str).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// The plugin has to be the module’s default export
module.exports = Sharp;
