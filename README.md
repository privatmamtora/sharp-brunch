sharp-brunch
===========================
> Resize JPEG, PNG, WebP and TIFF images

### Prerequisites

* Node.js v4+
* libvips v8.0+

General Setup: [Sharp Installation](http://sharp.dimens.io/en/stable/install/)

#### OSX Prerequisites Setup

**Recommended:**

	brew install vips --with-cfitsio --with-graphicsmagick --with-libmatio --with-mozjpeg --with-openexr --with-openslide --with-python3 --with-webp

**Important**: note the added `--with-mozjpeg` option, it enables certain `options`

### Usage
Install the plugin via npm with `npm install --save sharp-brunch`.

Or, do manual install:

* Add `"sharp-brunch": "x.y.z"` to `package.json` of your brunch app.
* If you want to use git version of plugin, add
`"sharp-brunch": "https://github.com/privatmamtora/sharp-brunch.git"`.

**Recommended:** this should be placed last in `package.json`

### Options
There are a few quirks:
The `sharp` value can either be an object containing the options or an array of options.

* __src__: *(String)* Default `'public/images'`. Where to look for images, only directory, no patterns. It will ignore picking up files in the `dest` directory.
* __dest__: *(String)* Default `'public/images/min'`. Where to save new images, only directory, no patterns
* __imageExt__: *(Array)* Default: `['png',
                'tiff', 'tif',
                'webp',
                'jpeg', 'jpg', 'jpe', 'jif', 'jfif', 'jfi']`. The images to filter. If invalid file extensions are provided it will crash and burn.
* __tasks__: *(Array)* Defaults defined by `sharp`. Either an array of multiple tasks to perform on the images or a single task. An individual task is composed of operations. If multiple tasks are defined without a `rename` operation, then images will be overwritten.
    * __rename__: *(String)* No default. A template to rename files. Example below.
        * __base__: The original file name
        * __ext__: The original file extension (will appropriatly change if image converted, but must be used)

#### Simple Example:
```coffeescript
exports.config =
   ...
   plugins:
    sharp:
      src: 'public/images'
      imageExt: [ "jpeg", "jpg" ]
      tasks:
        [
          {resize: [1000, 1000]}
          {quality : 95}
          {withoutAdaptiveFiltering: true}
          {overshootDeringing: true}
          {optimiseScans: true}
          {rename: '{base}-1000.{ext}'}
        ]
```
#### Full Example:
```coffeescript
exports.config =
   ...
   plugins:
    sharp:
      [
        src: 'public/images'
        imageExt: [ "png" ]
        tasks:
          [
            [
              {resize: [1200, 1200]}
              {toFormat: "jpeg"}
              {quality : 95}
              {withoutAdaptiveFiltering: true}
              {optimiseScans: true}
              {rename: '{base}-1200.{ext}'}
            ]
          ,
            [
              {resize: [1000, 1000]}
              {toFormat: "jpeg"}
              {quality : 25}
            ]
          ]
      ,
        src: 'public/images'
        imageExt: [ "jpeg", "jpg" ]
        tasks:
          [
            {resize: [1000, 1000]}
            {quality : 95}
            {overshootDeringing: true}
            {optimiseScans: true}
            {rename: '{base}-1000.{ext}'}
          ]
      ]
```

### Sharp Options

Here are a few quirks not mentioned on the `sharp` api docs.

The `sharp` api really confuses between "resize" and "crop"
The two options work together to either perform a `resize` or `crop`

    { resize : [1024, 600] } // resize width to 1024px, and height 600px (this does a crop, if you want to resize then use `ignoreAspectRatio`)

<!--`crop` works but only with

    resize: [1024, 600]
    Not:
	resize: [1024]

   Will not work with `ignoreAspectRatio`, will simply resize-->

`embed`: Will not work with `max` or `min` options

`withoutEnlargement`: **Recommended** (It will not grow the image if it is smaller than the resize `values`)

`ignoreAspectRatio`: Will override `max` and `min` actions that would normally maintain aspect ratio

`blur`

> `0.3` - ? Tested upper limit `200`, almost turned image into a blob
>
>The more higher, the more cpu required.
>
>Recommended: <`100`

`sharpen`

> radius: >= 1

> flat: 0.00 - <= 13.9 (Valid tested values)

> jagged: 1 - 50+


### TODO:
* Update so `src` and `dest` takes a pattern to be used for `glob`ing
