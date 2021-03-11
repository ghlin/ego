import { join } from 'path'
import { Configuration } from 'webpack'
import merge from 'webpack-merge'
import { baseConfig, BASE_DIR, SRC_ROOT_DIR } from './base'

const WEBPACK_DEV_SERVER_WS_ADDR = process.env.HOST_ADDR ?? 'http://localhost:8080'

const config: Configuration & { devServer: any } = {
  mode: 'development',
  entry: [
    `webpack-dev-server/client?${WEBPACK_DEV_SERVER_WS_ADDR}`,
    //  'webpack/hot/only-dev-server',
    join(SRC_ROOT_DIR, 'index.ts')
  ],
  devServer: {
    port: 8080,
    hot: true,
    host: '0.0.0.0',
    disableHostCheck: true,
    stats: 'minimal',
    contentBase: BASE_DIR,
    publicPath: '/',
    overlay: true,
  }
}

module.exports = merge(baseConfig({ plugins: [] }), config)
