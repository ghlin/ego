import { join, normalize, resolve } from 'path'
import { Configuration, DefinePlugin } from 'webpack'
// import * as CopyWebpackPlugin from 'copy-webpack-plugin'
import * as HTMLWebpackPlugin from 'html-webpack-plugin'

/**
 * project base dir
 */
export const BASE_DIR = normalize(resolve(__dirname, '..', '..'))

/**
 * root of project source files
 */
export const SRC_ROOT_DIR = join(BASE_DIR, 'src')

export interface WebpackBaseOptions {
  plugins?: Configuration['plugins']
}

export function baseConfig(options: WebpackBaseOptions): Configuration {
  return {
    devtool: 'inline-source-map',

    entry: join(SRC_ROOT_DIR, 'index.ts'),

    output: {
      path: join(BASE_DIR, 'dist'),
      filename: 'bundle.js',
      publicPath: ''
    },

    resolve: {
      extensions: ['.js', '.ts', '.jsx', '.tsx', '.json']
    },

    module: {
      rules: [
        {
          test: /\.(tsx?)/,
          use: ['ts-loader'],
          exclude: /node_modules/
        },
        {
          test: /\.(?:ico|gif|png|jpg|jpeg|webp|bmp)$/,
          use: ['url-loader']
        }
      ]
    },

    plugins: [
      new DefinePlugin({
        SERVER_URL: `'${process.env.HOST_ADDR ?? 'http://localhost:8080'}'`
      }),
      new HTMLWebpackPlugin({
        template: join(SRC_ROOT_DIR, 'index.html'),
        inject: false
      }),
      ...(options.plugins ?? [])
    ]
  }
}
