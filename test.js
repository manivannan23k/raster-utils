
RasterUtils.reproject("samples/wgs84.tif", 3857, {
    xRes: 80,
    yRes: -80,
    interpolation: "bicubic"
})
.then(data=>{
    RasterUtils.rasterObjToAb(data.data).then(r=>{
        RasterUtils.saveAbAsTiff('test.tif', r);
    });
})
.catch(e=>console.log(e));
