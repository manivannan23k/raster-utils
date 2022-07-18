module.exports = {
    entry: './src/js/index.js',
    mode: 'development',
    output: {
      path: `${__dirname}/dist`,
      publicPath: `/weather-lib/dist/`,
      filename: 'index.js',
      library: 'W',
      libraryTarget: 'umd',
    },
    module: {
        rules: [
          {
            test: /\.css$/,
            use: [
              'style-loader',
              'css-loader',
            ],
          },
          {
            test: /\.ttf$/,
            use: [
              'url-loader',
            ],
          },
          {
            test: /\.s[ac]ss$/i,
            use: [
              // Creates `style` nodes from JS strings
              'style-loader',
              // Translates CSS into CommonJS
              'css-loader',
              // Compiles Sass to CSS
              'sass-loader',
            ],
          },
          {
            test: /\.(png|jpg|proto)$/, 
            use: "file-loader"
            //?name=images/[name].[ext]
          },
          {
            test: /\.js$/,
            enforce: 'pre',
            use: ['source-map-loader'],
          }
        ],
    },
  };