'use strict';

var path = require('path');

var sharp = require('sharp');
var fs = require('fs');
var _ = require('lodash');
var mkdirp = require('mkdirp');
var anymatch = require('anymatch');
var glob = require('glob');

// Default marker.  Can be configured via `plugins.gitSHA.marker`.
var PLUGIN_NAME = 'sharp-brunch';

function Sharp(config) {
    var cfg,
        shConfig = {
            src: 'public/images',
            dest: 'public/images/min',
            imageExt: ['png',
                'tiff', 'tif',
                'webp',
                'jpeg', 'jpg', 'jpe', 'jif', 'jfif', 'jfi']
            //,imageNot: ['gif',
            //    'bmp', 'dib']
            //,'imageOutput': ['jpeg', 'png', 'webp', 'raw']
        };

    if (config && config.plugins && config.plugins.sharp) {
        cfg = config.plugins.sharp;
    } else {
        cfg = {};
    }

    //Merge default options and normalize options to array
    if (_.isArray(cfg)) {
        cfg = _.map(cfg, function (conf) {
            return _.defaultsDeep({}, conf, shConfig);
        });
    } else {
        cfg = [_.defaultsDeep({}, cfg,shConfig)];
    }

    //Normalize the tasks property to always be tasks
    cfg = _.map(cfg, function(conf) {
        if(!_.isArray(conf.tasks[0])) {
            conf.tasks = [conf.tasks];
            return conf;
        }
        return conf;
    });

    // Had to move the logic down because
    // the object was being contaminated after it was used
    //var start = process.hrtime();
    //_.map(cfg, function(conf){
    //    conf.tasks = createTransforms(conf.tasks);
    //    return conf;
    //},this);

    this.options = cfg;
}

// Tell Brunch we are indeed a plugin for it
Sharp.prototype.brunchPlugin = true;

Sharp.prototype.onCompile = function(generatedFiles) {
    var cfg = this.options;

    //if (!this.validateConfig()) return;

    _.forEach(cfg, function(conf){
        var imageFiles = fetchFiles(conf.src, conf.dest, conf.imageExt);

        _.forEach(imageFiles, function (file) {
            _.forEach(conf.tasks, function(task){
                // Recreated every time because the object is a reference and
                // it got contaminated each time.
                task = createSharpPipeline(task);

                sharp(file.src)
                    .pipe(task.task)
                    .toBuffer()
                    .then(function (data) {
                    //writeFile(file, task, data, function (error) {
                    //    console.error(PLUGIN_NAME + ": " + error.message);
                    //});
                    return writeFilePromise(file, task, data);
                }).catch(function(error) {
                    console.error(PLUGIN_NAME + ': ' + error.message);
                });
            });
        });
    });
};

Sharp.prototype.validateConfig = function(callback) {
    if ( this.options === undefined ) {
        //This will never happen
        return console.error(PLUGIN_NAME + ': Missing options object');
    }

    if (!this.options.imageExt || this.options.imageExt.constructor !== Array) {
        return console.error(PLUGIN_NAME +
            ': The option \'imageExt\' must be an array');
    }

    return true;
};

// Find files
var fetchFiles = function(src, dest, imageExt) {
    // Need to allow consumer to control options
    // TODO: Update to allow full glob pattern support

    src = path.join(src, '/**/*');
    dest = path.join(dest, '/**/*');

    var buildExtPattern = function(extList) {
        return new RegExp('\.(' + extList.join('|') + ')$');
    };

    var files = glob.sync(src, {nodir: true, ignore: dest})
                    .filter(anymatch(buildExtPattern(imageExt)));

    var buildFileObj = function (file) {
        return {src: file,
                ext: path.extname(file),
                dest: destFile(file, src, dest)};
    };

    return _.map(files, buildFileObj);
};

var destFile = function (file, src, dest) {

    var nest = path.relative(src, path.dirname(file));
    //console.log("Src: " + nest);
    return path.join(dest, nest, path.basename(file));
};

// Write File
var writeFile = function (file, task, contents, callback) {

    var dir = path.dirname(file.dest);

    mkdirpPromise(dir).then(function() {
        // Figure out the extension
        var ext = '';
        if(task.ext) {
            // If file format was converted
            ext = removeExtDot(task.ext);
        } else {
            // Use original extension
            ext = removeExtDot(file.ext);
        }

        var dest = file.dest;
        // Replace extension (incase when `toFormat` is used but no `rename`)
        dest = replaceExt(dest, ext);

        if(task.rename) {
            // Get base file name
            var base = path.basename(dest, path.extname(dest));

            // Do the magic rename
            dest = path.join(dir,
                            processName(task.rename, {base: base, ext: ext}));
        }

        fs.writeFile(dest, contents, function(err) {
            if (err) {
                return callback(err);
            }
            console.log(PLUGIN_NAME + ': ' + dest + ' (' + 'Success' + ')');
        });
    }).catch(function(error) {
        return callback(error);
    });
};

// Pipeline
var createTransforms = function (tasks) {
    var t = [];
    _.forEach(tasks, function(task){
        t.push(createSharpPipeline(task));
    }, this);
    return t;
};

var createSharpPipeline = function (opts) {
    var p = [];
    var rename = '';
    var ext = '';
    _.forOwn(opts, function(val, key) {
        if (val.crop) {
            p.push(getTask('crop', sharp.gravity[val.crop]));
        } else if (val.resize) {
            p.push(getTask('resize', val.resize));
        } else if (val.interpolateWith) {
            p.push(getTask('interpolateWith',
                    sharp.interpolator[val.interpolateWith]));
        } else if (val.extract) {
            p.push(getTask('extract',
                    [val.extract.top,
                        val.extract.left,
                        val.extract.width,
                        val.extract.height]));
        } else if (val.toFormat) {
            p.push(getTask('toFormat', sharp.format[val.toFormat]));
            ext = val.toFormat;
        } else if (val.rename) {
            rename = val.rename;
        } else {
            var method = Object.keys(val)[0];
            p.push(getTask(method, val[method]));
        }
    });

    p = _.compact(p);
    return {task: buildTransform(p), rename: rename, ext: ext};
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

var buildTransform = function(ops) {
    var trans = sharp();
    _.forEach(ops, function(n, key) {
        if (trans[n[0]]) {
            trans[n[0]].apply(trans, [].concat(n[1]));
        }
    });
    return trans;
};

// Promisifing
var writeFilePromise = function(file, task, data) {
    return new Promise(function(_resolve, _reject) {
        writeFile(file, task, data, function (err) {
            return err === null ? _resolve() : _reject(err);
        });
    })
        .catch(function (err) {
            throw err;
        });
};

var mkdirpPromise = function(dir, opts) {
    return new Promise(function (_resolve, _reject) {
        mkdirp(dir, opts, function (err, made) {
            return err === null ? _resolve(made) : _reject(err);
        });
    })
        .catch(function (err) {
            throw err;
        });
};

// Helper functions
var replaceExt = function (pathStr, ext) {
    return path.join(
        path.dirname(pathStr),
        path.basename(pathStr,
        path.extname(pathStr)) + '.' + removeExtDot(ext));
};

var removeExtDot = function(ext){
    if(ext.indexOf('.') === 0){
        return ext.substr(1);
    }
    return ext;
};

var processName = function (name, data) {
    return name.replace(/{([^{}]*)}/g,
        function (a, b) {
            var r = data[b];
            return typeof r === 'string' || typeof r === 'number' ? r : a;
        }
    );
};

// The plugin has to be the module’s default export
if (typeof module !== 'undefined') {
    module.exports = Sharp;
}
