Sharp for Brunch

Will take

`resize` works

    { resize : [1024, 600] } // resize width to 1024px, and height 600px (this does a crop, if you want to resize to this hen use `ignoreAspectRatio`)
    { resize : [1024] } // resize width to 1024px and auto-height
    { resize : [0,600] } // auto-width, and resize to 600px

`crop` works but only with

    resize: [1024, 600]
    Not:

    resize: [1024]

    Will not work with `ignoreAspectRatio`, will simply resize

`embed` works

    Will mantain aspect ratio while resizing to width or height and embed into a background of size specified
    Wil not work with `max` or `min` options

`background` works:

    Only works with embed and flatten options

`max` works

`min` works

`withoutEnlargement` works

By default this is enabled. (It will not grow the image if it is smaller than the resize `values`)

`ignoreAspectRatio` works

This is used when you just want to stretch the image, either by width or height or both

This also overrides max and min actions that would maintain aspect ratio

`interpolateWith` works

`extract` works

`background` works

`flatten` (not tested)

`rotate` works

Only use `90`, `180` or `270`

`flip` works

`flop` works

`blur` works

`0.3` - ?: Tested upper limit `200`, almost turned image into a blob
The more higher, the more cpu required.
Recommended: <`100`

Also takes `true` but almost no difference

`sharpen` works

radius: >= 1
flat: 0.00 - <= 13.9 (Valid tested values)
jagged: 1 - 50+

`gamma` works

`greyscale` and `grayscale` works

`normalize` and `normalise` works

`overlayWith` works

`toFormat` works

`quality` works

`progressive` works

`withMetadata` - Tested but not with sample

`withoutChromaSubsampling` - Tested but can't see the difference (file sizes are different)

`compressionLevel` works

`withoutAdaptiveFiltering` - Tested but can't see the difference (file sizes are different)

`trellisQuantisation` and `trellisQuantization` - Tried to test but vips ignores the option, so doesn't work

`overshootDeringing` - Tried to test but vips ignores the option, so doesn't work

`optimiseScans` and `optimizeScans` - Tried to test but vips ignores the option, so doesn't work

*resize([width], [height])
*crop([gravity])
*embed()
*max()
*min()
*withoutEnlargement()
*ignoreAspectRatio()
*interpolateWith(interpolator)
*extract(top, left, width, height)
*background(rgba)
*flatten()
*rotate([angle])
*flip()
*flop()
*blur([sigma])
*sharpen([radius], [flat], [jagged])
*gamma([gamma])
*grayscale() / greyscale()
*normalize() / normalise()
*overlayWith(filename)
*toFormat(format) = jpeg() png() webp() raw()
*quality(quality)
*progressive()
*withMetadata([metadata])
TODO: tile([size], [overlap])
*withoutChromaSubsampling()
*compressionLevel(compressionLevel)
*withoutAdaptiveFiltering()
*trellisQuantisation() / trellisQuantization()
*overshootDeringing()
*optimiseScans() / optimizeScans()
