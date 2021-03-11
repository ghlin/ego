import { Configuration } from 'webpack'
import merge from 'webpack-merge'
import { baseConfig } from './base'

const config: Configuration = {
  mode: 'production',
  devtool: 'cheap-module-source-map',
}

module.exports = merge(baseConfig({ plugins: [] }), config)
