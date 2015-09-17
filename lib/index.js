'use strict';

var path = require('path');

var sharp = require('sharp');
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

function Sharp(config) {
    var cfg,
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

    this.options = _.defaultsDeep({}, cfg, shConfig);
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
    //console.log(JSON.stringify(imageFiles, null, '\t'));
    if (imageFiles.length > 0) {
        var pip = this.createSharpPipeline(cfg.options);

        _.map(imageFiles, function (file) {
            console.log(file.src);
            //var ro = sharp().rotate(90);
            //var re = sharp().resize(1200).on('error', function(err) {
            //    console.log(err);
            //});
            //var test1 = sharp().jpeg().trellisQuantisation();

            var trans = sharp();

            _.forEach(pip, function(n, key) {
                //console.log(JSON.stringify(n, null, '\t'));
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
            });

            //console.log(sharp(file.src).pipe(trans));
            sharp(file.src).pipe(trans).toBuffer().then(function (data) {
                //var dest = destFile(file.src, cfg.src, cfg.dest);
                writeFile(file.dest, data, function (error) {
                        console.error(PLUGIN_NAME + ": " + error.message);
                    });
            });
        });
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
    //} else if ( ! _.isPlainObject(this.options.options) ) {
    //    return console.error(PLUGIN_NAME + ': options object must be plain object (created with `{}` literal) ');
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
    // TODO: Update to allow full glob pattern support

    var files = glob.sync(path.join(this.options.src, "/**/*"), {nodir: true, ignore: path.join(this.options.dest, "/**/*")}).filter(this.imageExtMatcher);
    return _.map(files, function (file) {
       return {src: file, ext: path.extname(file), dest: destFile(file, this.options.src, this.options.dest)};
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

var writeFile = function (filePath, contents, callback) {
    mkdirp(path.dirname(filePath), function (err) {
        if (err) return callback(err);
        fs.writeFile(filePath, contents, function(err) {
            if (err) return callback(err);

            console.log(PLUGIN_NAME + ": " + filePath + " (" + "Success" + ")");
        });
    });
    //mkdirp.sync(path.dirname(filePath));
    //fs.writeFileSync(filePath, contents);
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
        callback(null, info);
    });
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

Sharp.prototype.createSharpPipeline = function (opts) {
    var p = [];
    _.forOwn(opts, function(val, key) {
        //console.log(Object.keys(value)[0]);
        //console.log(value[Object.keys(value)[0]]);
        if (val.crop) {
            p.push(getTask('crop', sharp.gravity[val.crop]));
        } else if (val.resize) {
            p.push(getTask('resize', val.resize));
        } else if (val.interpolateWith) {
            p.push(getTask('interpolateWith', sharp.interpolator[val.interpolateWith]));
        } else if (val.extract) {
            p.push(getTask('extract', [val.extract.top, val.extract.left, val.extract.width, val.extract.height]));
        } else if (val.toFormat) {
            p.push(getTask('toFormat', sharp.format[val.toFormat]));
        } else {
            var method = Object.keys(val)[0];
            p.push(getTask(method, val[method]));
        }
    });

    p.push(false);
    p = _.compact(p);
    return p;
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

// Helper: escapes any regex-special character
function escapeRegex(str) {
    return String(str).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// The plugin has to be the module’s default export
module.exports = Sharp;
