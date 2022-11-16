
// RasterUtils.reproject("samples/wgs84.tif", 3857, {
//     xRes: 80,
//     yRes: -80,
//     interpolation: "bicubic"
// })
// .then(data=>{
//     let r = RasterUtils.rasterObjToAb(data.data);
//     RasterUtils.saveAbAsTiff('test.tif', r);
// })
// .catch(e=>console.log(e));

const init = async () => {
    console.log(Raster.evaluate('10 * (10-2)'));
    // let raster = await Raster.load('samples/wgs84.tif');
    // let raster2 = await Raster.reproject(raster, 3857, {xRes:100, yRes:-100, interpolation: 'bicubic'});
    // // let raster2 = await Raster.load(data);
    // data = await raster2.getData()
    // console.log(data)
    // // // raster.save('original.tif')
    // // raster2.save('reprojected.tif')
}

init()
