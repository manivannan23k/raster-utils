import { fromArrayBuffer } from './geotiff/geotiff';
import { writeGeotiff } from './geotiff/writer';
import proj4 from './proj4-full';

class Raster{

    constructor(tiff, image, ab){
        this.tiff = tiff;
        this.image = image;
        this.ab = ab;
    }

    static async load(data){
        let ab = null;
        switch (data.constructor.name) {
            case "String":
                if (Raster.validUrl(data)) {
                    ab = await Raster.fetchArrayBuffer(data);
                }else{
                    throw "Not a valid url";
                }
                break;
            case "ArrayBuffer":
                ab = data;
                break;
        }
        if(!Boolean(ab)){
            throw "Not a valid data";
        }
        let tiff = await fromArrayBuffer(ab);
        let image = await tiff.getImage();
        return new Raster(tiff, image, ab);
    }
    static validUrl(str){
        const pattern = new RegExp("^((https|http|ftp|rtsp|mms)?://)"
            + "?(([0-9a-z_!~*'().&=+$%-]+: )?[0-9a-z_!~*'().&=+$%-]+@)?"
            + "(([0-9]{1,3}\.){3}[0-9]{1,3}"
            + "|"
            + "([0-9a-z_!~*'()-]+\.)*"
            + "([0-9a-z][0-9a-z-]{0,61})?[0-9a-z]\."
            + "[a-z]{2,6})"
            + "(:[0-9]{1,4})?"
            + "((/?)|"
            + "(/[0-9a-z_!~*'().;?:@&=+$,%#-]+)+/?)$");
        return !!pattern.test(str);
    }

    getOrigin(){
        return this.image.getOrigin();
    }

    getResolution(){
        return this.image.getResolution();
    }

    getBoundingBox(){
        const bbox = this.image.getBoundingBox();
        return [
            bbox[0],
            bbox[3],
            bbox[2],
            bbox[1]
        ]
    }

    getCoordinateSystem(){
        return this.image.geoKeys["GeographicTypeGeoKey"]  || this.image.geoKeys["ProjectedCSTypeGeoKey"]
    }

    getGeographicTypeGeoKey(){
        return this.image.geoKeys["GeographicTypeGeoKey"]
    }

    getProjectedCSTypeGeoKey(){
        return this.image.geoKeys["ProjectedCSTypeGeoKey"]
    }

    getWidth(){
        return this.image.getWidth()
    }

    getHeight(){
        return this.image.getHeight()
    }

    getBitsPerSample(){
        return this.image.getBitsPerSample()
    }

    getSampleFormat(){
        return this.image.getSampleFormat()
    }

    getMetadata(){
        return {
            coordinateSystem: this.getCoordinateSystem(),
            max: null,
            min: null,
            nx: this.getWidth(),
            ny: this.getHeight(),
            rasterData: [],
            x1: this.getBoundingBox()[0],
            y1: this.getBoundingBox()[1],
            x2: this.getBoundingBox()[2],
            y2: this.getBoundingBox()[3],
            xRes: this.getResolution()[0],
            yRes: this.getResolution()[1],
            bitsPerSample: this.getBitsPerSample(),
            sampleFormat: this.getSampleFormat(),
            geographicTypeGeoKey: this.getGeographicTypeGeoKey(),
            projectedCSTypeGeoKey: this.getProjectedCSTypeGeoKey()
        }
    }

    async getData(){
        const metaData = this.getMetadata();
        let bands = await this.image.readRasters();
        const nb = bands.length;
        if (nb===0){
            return [];
        }
        let rasterData = [], min = null, max = null;
        for (let bandNo = 0; bandNo < bands.length; bandNo++) {
            const band = bands[bandNo];
            rasterData[bandNo] = [];
            for (let y = 0; y < this.getHeight(); y++) {
                rasterData[bandNo][y] = [];
                for (let x = 0; x < this.getWidth(); x++) {
                    const v = band[(y*bands.width)+x];
                    if (min===null || min > v)
                        min = v;
                    if (max===null || max < v)
                        max = v;
                    rasterData[bandNo][y][x] = v;
                }
            }
        }

        return {...metaData,rasterData:rasterData[0], min, max}
    }

    save(fname) {
        var blob = new Blob([this.ab], {type: "image/tiff"});
        var link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = fname;
        link.click();
    }

    static getValueAt(x, y, bandNo, srcData, interp) {
        let xi =  (x - srcData.x1)/srcData.xRes, yi =  (y - srcData.y1)/srcData.yRes;
        switch(interp){
            case 'bicubic':
                return Raster.bicubic(srcData.rasterData[bandNo], yi, xi, srcData.nx, srcData.ny);
            case 'bilinear':
                return Raster.bilinear(srcData.rasterData[bandNo], yi, xi, srcData.nx, srcData.ny);
            default:
                return Raster.nearestNeighbour(srcData.rasterData[bandNo], yi, xi, srcData.nx, srcData.ny) || 0;
        }
    }

    static nearestNeighbour (values, x, y, width, height) {
        y = Math.round(y);
        x = Math.round(x);
        if (y < 0 || x < 0 || y > height || x > width) {
            return 0;
        }
        y = Math.max(Math.floor(y), 0);
        x = Math.max(Math.floor(x), 0);
        y = Math.min(Math.ceil(y), height - 1);
        x = Math.min(Math.ceil(x), width - 1);
        try{
            return values[y][x];
        }catch(e){
            return 0;
        }
    }
    static bilinear(values, x, y, width, height) {
        let x1 = Math.floor(x - 1), y1 = Math.floor(y - 1), x2 = Math.ceil(x + 1), y2 = Math.ceil(y + 1);
        x1 = Math.max(0, x1);
        x2 = Math.max(0, x2);
        y1 = Math.max(0, y1);
        y2 = Math.max(0, y2);
        x1 = Math.min(height - 1, x1);
        x2 = Math.min(height - 1, x2);
        y1 = Math.min(width - 1, y1);
        y2 = Math.min(width - 1, y2);
        let q11 = (((x2 - x) * (y2 - y)) / ((x2 - x1) * (y2 - y1))) * values[x1][y1]
        let q21 = (((x - x1) * (y2 - y)) / ((x2 - x1) * (y2 - y1))) * values[x2][y1]
        let q12 = (((x2 - x) * (y - y1)) / ((x2 - x1) * (y2 - y1))) * values[x1][y2]
        let q22 = (((x - x1) * (y - y1)) / ((x2 - x1) * (y2 - y1))) * values[x2][y2]
        return q11 + q21 + q12 + q22
    }
    static bicubic (values, x, y, width, height){
        function bicubicInterpolation(r1, r2, r3, r4, dx, dy){
            function cubicInterpolation(p, dx){
                return p[1] + 0.5 * dx*(p[2] - p[0] + dx*(2.0*p[0] - 5.0*p[1] + 4.0*p[2] - p[3] + dx*(3.0*(p[1] - p[2]) + p[3] - p[0])));
            }
            return cubicInterpolation([
                cubicInterpolation(r1, dx), 
                cubicInterpolation(r2, dx), 
                cubicInterpolation(r3, dx), 
                cubicInterpolation(r4, dx)
            ], dy);
        }
        const m = height;
        const n = width;
        if(x<=1 || x>=n-2 || y<=1 || y>=m-2){
            return Raster.nearestNeighbour(values, x, y, width, height) || 0;
        }
        let _x = Math.floor(x);
        let _y = Math.floor(y);
        let r1 = [
            values[_y-1][_x-1], values[_y-1][_x], values[_y-1][_x+1], values[_y-1][_x+2]
        ];
        let r2 = [
            values[_y][_x-1], values[_y][_x], values[_y][_x+1], values[_y][_x+2]
        ];
        let r3 = [
            values[_y+1][_x-1], values[_y+1][_x], values[_y+1][_x+1], values[_y+1][_x+2]
        ];
        let r4 = [
            values[_y+2][_x-1], values[_y+2][_x], values[_y+2][_x+1], values[_y+2][_x+2]
        ];
        let dx = x - _x, dy = y - _y;
    
        return bicubicInterpolation(
            r1, r2, r3, r4, dx, dy
        );
    }
    static evaluate(expr, scope) {
        const numReg = /^(-|)[0-9\.]{1,}/;
        const varReg = /^((\.|)([a-zA-Z][a-zA-Z0-9\.]*))/;
        const multi = (n1, n2) => n1 * n2;
        const div = (n1, n2) => n1 / n2;
        const add = (n1, n2) => n1 + n2;
        const sub = (n1, n2) => n1 - n2;
      
        function resolve(path, currObj, globalCheck) {
          if (path === "") return currObj;
          try {
            if (typeof path === "string") path = path.split(".");
            for (let index = 0; index < path.length; index += 1) {
              currObj = currObj[path[index]];
            }
            if (currObj === undefined && !globalCheck) throw Error("try global");
            return currObj;
          } catch (e) {
            return resolve(path, {}, true);
          }
        }
      
        function multiplyOrDivide(values, operands) {
          const op = operands[operands.length - 1];
          if (op === multi || op === div) {
            const len = values.length;
            values[len - 2] = op(values[len - 2], values[len - 1]);
            values.pop();
            operands.pop();
          }
        }
      
        const resolveArguments = (initialChar, func) => {
          return function (expr, index, values, operands, scope, path) {
            if (expr[index] === initialChar) {
              const args = [];
              let endIndex = (index += 1);
              const terminationChar = expr[index - 1] === "(" ? ")" : "]";
              let terminate = false;
              let openParenCount = 0;
              while (!terminate && endIndex < expr.length) {
                const currChar = expr[endIndex++];
                if (currChar === "(") openParenCount++;
                else if (openParenCount > 0 && currChar === ")") openParenCount--;
                else if (openParenCount === 0) {
                  if (currChar === ",") {
                    args.push(expr.substr(index, endIndex - index - 1));
                    index = endIndex;
                  } else if (openParenCount === 0 && currChar === terminationChar) {
                    args.push(expr.substr(index, endIndex++ - index - 1));
                    terminate = true;
                  }
                }
              }
      
              for (let index = 0; index < args.length; index += 1) {
                args[index] = Raster.evaluate(args[index], scope);
              }
              const state = func(expr, path, scope, args, endIndex);
              if (state) {
                values.push(state.value);
                return state.endIndex;
              }
            }
          };
        };
      
        function chainedExpressions(expr, value, endIndex, path) {
          if (expr.length === endIndex) return { value, endIndex };
          let values = [];
          let offsetIndex;
          let valueIndex = 0;
          let chained = false;
          do {
            const subStr = expr.substr(endIndex);
            const offsetIndex =
              isolateArray(subStr, 0, values, [], value, path) ||
              isolateFunction(subStr, 0, values, [], value, path) ||
              (subStr[0] === "." && isolateVar(subStr, 1, values, [], value));
            if (Number.isInteger(offsetIndex)) {
              value = values[valueIndex];
              endIndex += offsetIndex - 1;
              chained = true;
            }
          } while (offsetIndex !== undefined);
          return { value, endIndex };
        }
      
        const isolateArray = resolveArguments(
          "[",
          (expr, path, scope, args, endIndex) => {
            endIndex = endIndex - 1;
            let value = resolve(path, scope)[args[args.length - 1]];
            return chainedExpressions(expr, value, endIndex, "");
          }
        );
      
        const isolateFunction = resolveArguments(
          "(",
          (expr, path, scope, args, endIndex) =>
            chainedExpressions(
              expr,
              resolve(path, scope).apply(null, args),
              endIndex - 1,
              ""
            )
        );
      
        function isolateParenthesis(expr, index, values, operands, scope) {
          const char = expr[index];
          if (char === "(") {
            let openParenCount = 1;
            let endIndex = index + 1;
            while (openParenCount > 0 && endIndex < expr.length) {
              const currChar = expr[endIndex++];
              if (currChar === "(") openParenCount++;
              if (currChar === ")") openParenCount--;
            }
            const len = endIndex - index - 2;
            values.push(Raster.evaluate(expr.substr(index + 1, len), scope));
            multiplyOrDivide(values, operands);
            return endIndex;
          }
        }
      
        function isolateOperand(char, operands) {
          switch (char) {
            case "*":
              operands.push(multi);
              return true;
              break;
            case "/":
              operands.push(div);
              return true;
              break;
            case "+":
              operands.push(add);
              return true;
              break;
            case "-":
              operands.push(sub);
              return true;
              break;
          }
          return false;
        }
      
        function isolateValueReg(reg, resolver) {
          return function (expr, index, values, operands, scope) {
            const match = expr.substr(index).match(reg);
            let args;
            if (match) {
              let endIndex = index + match[0].length;
              let value = resolver(match[0], scope);
              if (!Number.isFinite(value)) {
                const state = chainedExpressions(expr, scope, endIndex, match[0]);
                if (state !== undefined) {
                  value = state.value;
                  endIndex = state.endIndex;
                }
              }
              values.push(value);
              multiplyOrDivide(values, operands);
              return endIndex;
            }
          };
        }
      
        const isolateNumber = isolateValueReg(numReg, Number.parseFloat);
      
        const isolateVar = isolateValueReg(varReg, resolve);
        const allowVars = typeof scope === "object";
        let operands = [];
        let values = [];
        let prevWasOpperand = true;
      
        for (let index = 0; index < expr.length; index += 1) {
          const char = expr[index];
          if (prevWasOpperand) {
            let newIndex =
              isolateParenthesis(expr, index, values, operands, scope) ||
              isolateNumber(expr, index, values, operands, scope) ||
              (allowVars && isolateVar(expr, index, values, operands, scope));
            if (Number.isInteger(newIndex)) {
              index = newIndex - 1;
              prevWasOpperand = false;
            }
          } else {
            prevWasOpperand = isolateOperand(char, operands);
          }
        }
        let value = values[0];
        for (let index = 0; index < values.length - 1; index += 1) {
          value = operands[index](values[index], values[index + 1]);
          values[index + 1] = value;
        }
        return value;
    }

    static fetchArrayBuffer(url){
        return new Promise((resolve, reject) => {
            fetch(url)
            .then(r=>r.arrayBuffer())
            .then(async (ab)=>{
                return resolve(ab);
            })
            .catch(e=>{
                console.log(e);
                return reject(e);
            });
        })
    }

    static getDefaultWarp(srcRaster, targetSrs, options){
        const srcMetaData = srcRaster.getMetadata()
        if(!options){
            options = {};
        }
        let prj = proj4(`EPSG:${srcMetaData.coordinateSystem}`, `EPSG:${targetSrs}`);
        let nw = prj.forward([srcMetaData.x1, srcMetaData.y1]),
            se = prj.forward([srcMetaData.x2, srcMetaData.y2]);
    
        let outNx, outNy, outBbox, outXRes, outYRes;
    
        
        
        if(options.x1 && options.y1 && options.x2 && options.y2){
            outBbox = [
                options.x1, options.y1, options.x2, options.y2
            ];
        }else{
            outBbox = [
                nw[0], nw[1], se[0], se[1]
            ];
        }
    
        if(options.xRes && options.yRes){
            outXRes = options.xRes;
            outYRes = options.yRes;
    
            outNx = Math.ceil(
                (outBbox[2] - outBbox[0])/outXRes
            );
            outNy = Math.ceil(
                (outBbox[3] - outBbox[1])/outYRes
            );
        }else if(options.nx && options.ny){
            outNx = options.nx;
            outNy = options.ny;
            
            outXRes = (
                (outBbox[2] - outBbox[0])/outNx
            );
            outYRes = (
                (outBbox[3] - outBbox[1])/outNy
            );
        }else{
            let diagCount = Math.floor(Math.sqrt(
                Math.pow(srcMetaData.nx, 2) + Math.pow(srcMetaData.ny, 2)
            ));
            
            let outRes = Math.sqrt(
                Math.pow(outBbox[0] - outBbox[2], 2) + Math.pow(outBbox[1] - outBbox[3], 2)
            )/diagCount;
            outXRes = outRes;
            outYRes = -outRes;
            outNx = Math.ceil(
                (outBbox[2] - outBbox[0])/outXRes
            );
            outNy = Math.ceil(
                (outBbox[3] - outBbox[1])/outYRes
            );
        }
    
        return {
            coordinateSystem: targetSrs,
            max: null,
            min: null,
            nx: outNx,
            ny: outNy,
            rasterData: [],
            x1: outBbox[0],
            y1: outBbox[1],
            x2: outBbox[2],
            y2: outBbox[3],
            xRes: outXRes,
            yRes: outYRes,
            bitsPerSample: srcMetaData.bitsPerSample,
            sampleFormat: srcMetaData.sampleFormat,
            geographicTypeGeoKey: srcMetaData.geographicTypeGeoKey,
            projectedCSTypeGeoKey: srcMetaData.projectedCSTypeGeoKey
        }
    }

    static objToAb(data) {
        let crsKeys = {};
        let GeoCrs = [4326];
        if(GeoCrs.indexOf(data.coordinateSystem)===-1){
            crsKeys['ProjectedCSTypeGeoKey'] = data.coordinateSystem;
        }else{
            crsKeys['GeographicTypeGeoKey'] = data.coordinateSystem;
        }
        let metadata = {
            width: data.nx,
            height: data.ny,
            BitsPerSample: [data.bitsPerSample],
            SampleFormat: [data.sampleFormat],
            ModelPixelScale: [data.xRes, -data.yRes, 0],
            ModelTiepoint: [0, 0, 0, data.x1, data.y1, 0],
            ...crsKeys
        };
        return writeGeotiff(data.rasterData, metadata); //Returns array buffer
    }

    static async reproject(srcRaster, targetSrs, options){
        if(!Boolean(options)) options = {};
        if(!Boolean(options.interpolation)) options.interpolation = 'nearestNeighbour';
        const srcData = await srcRaster.getData();
        let prj = proj4(`EPSG:${srcData.coordinateSystem}`, `EPSG:${targetSrs}`);
        let outData = Raster.getDefaultWarp(srcRaster, targetSrs, options);
        for (let bandNo = 0; bandNo < srcData.rasterData.length; bandNo++) {
            outData.rasterData[bandNo] = [];
            for(let y=0;y<outData.ny;y++){
                outData.rasterData[bandNo][y] = [];
                for(let x=0;x<outData.nx;x++){
                    let _ox = outData.x1 + x * outData.xRes, _oy = outData.y1 + y * outData.yRes;
                    let _ic = prj.inverse([_ox, _oy]);
                    let v = Raster.getValueAt(_ic[0], _ic[1], bandNo, srcData, options.interpolation);
                    outData.rasterData[bandNo][y][x] = v;
                    if (outData.min===null || outData.min > v)
                        outData.min = v;
                    if (outData.max===null || outData.max < v)
                        outData.max = v;
                }
            }
        }
        return await Raster.load(Raster.objToAb(outData));
    }

    static async mask(srcRaster, geojson){
        const isInsideGj = (coordinate, geojson) => {
            return true;
        }
        let nodata = -9999;
        let srcData = await srcRaster.getData();
        let outData = {
            coordinateSystem: srcRaster.coordinateSystem,
            max: null,
            min: null,
            nx: srcRaster.nx,
            ny: srcRaster.ny,
            rasterData: [],
            x1: srcRaster.x1,
            y1: srcRaster.y1,
            x2: srcRaster.x2,
            y2: srcRaster.y2,
            xRes: srcRaster.xRes,
            yRes: srcRaster.yRes,
            bitsPerSample: srcRaster.bitsPerSample,
            sampleFormat: srcRaster.sampleFormat,
            geographicTypeGeoKey: srcRaster.geographicTypeGeoKey,
            projectedCSTypeGeoKey: srcRaster.projectedCSTypeGeoKey,
            nodata: nodata
        }
        for (let bandNo = 0; bandNo < srcData.rasterData.length; bandNo++) {
            outData.rasterData[bandNo] = [];
            for(let y=0;y<outData.ny;y++){
                outData.rasterData[bandNo][y] = [];
                for(let x=0;x<outData.nx;x++){
                    let _ox = outData.x1 + x * outData.xRes, _oy = outData.y1 + y * outData.yRes;
                    let v = nodata;
                    if(isInsideGj([_ox, _oy], geojson)){
                        v = outData.rasterData[bandNo][y][x];
                        outData.rasterData[bandNo][y][x] = v;
                        if (outData.min===null || outData.min > v)
                            outData.min = v;
                        if (outData.max===null || outData.max < v)
                            outData.max = v;
                    }
                }
            }
        }

        return outData;
    }

}

export default Raster;