import fs from 'fs';
import { cyan } from 'colorette';
import open from 'open';
import path from 'path';
import * as qs from 'query-string';
import opapi from './opapi';
import { setDefaultOpenUrl, getConfigFiles, createBaseFromTemplate } from './utils';

const PLUGIN_NAME = 'docverse-rsbuild-debug-url';
const BASE_PATH = '/block';

export interface DocVerseRsbuildPluginOptions {
  open?: boolean;
  url?: string;
}

interface RsbuildLikeApi {
  onAfterStartDevServer?: (handler: (params: { port?: number }) => Promise<void> | void) => void;
  modifyRspackConfig?: (handler: (config: any) => any) => void;
}

async function resolveDebugUrl(url: string | undefined) {
  const {
    docsaddon: { url: configUrl },
    privatization,
  } = await getConfigFiles();

  let nextUrl = url ?? configUrl ?? '';
  if (!nextUrl) {
    if (privatization) {
      throw new Error('Create docsaddon failure. Please set url of docsaddon to "url" property in app.json');
    }
    const newBaseUrl = await createBaseFromTemplate('云文档小应用测试页面');
    console.info(`Create docsaddon successfully. The url ${newBaseUrl} will be written to app.json`);
    await setDefaultOpenUrl(newBaseUrl);
    nextUrl = newBaseUrl;
  }

  return nextUrl;
}

async function createDocsAddonMiddleware(port: number) {
  const { projectInfo, blockInfo } = await getConfigFiles();
  const config = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'app.json'), { encoding: 'utf-8' }),
  ) as AppConfig;
  const api = await opapi.init(config?.privatization ? { envConfig: config.privatization } : undefined);

  return api.dev.getBlockitDevMiddleware({
    projectConfig: projectInfo,
    blockConfigMap: {
      [blockInfo.blockTypeID]: blockInfo,
    },
    devServerHost: `http://localhost:${port}`,
    basePath: BASE_PATH,
  });
}

export function docVerseRsbuildPlugin(options: DocVerseRsbuildPluginOptions = {}) {
  let initPromise: Promise<string> | null = null;
  const shouldOpen = typeof options.open !== 'undefined' ? Boolean(options.open) : true;

  const ensureInitialized = (port: number) => {
    if (!initPromise) {
      initPromise = (async () => {
        const resolvedUrl = await resolveDebugUrl(options.url);
        const debugUrl = qs.stringifyUrl({
          url: resolvedUrl,
          query: {
            blockitdebug: true,
            debugport: port,
          },
        });

        console.info(`URL: ${cyan(debugUrl)}`);
        if (shouldOpen) {
          await open(debugUrl);
        }

        return resolvedUrl;
      })().catch((error) => {
        initPromise = null;
        throw error;
      });
    }

    return initPromise;
  };

  return {
    name: PLUGIN_NAME,
    setup(api: RsbuildLikeApi) {
      api.onAfterStartDevServer?.(async ({ port }) => {
        await ensureInitialized(port ?? 8080);
      });

      api.modifyRspackConfig?.((config: any) => {
        config.plugins = config.plugins || [];
        config.plugins.push({
          apply(compiler: any) {
            compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation: any) => {
              compilation.hooks.processAssets.tapPromise(
                {
                  name: PLUGIN_NAME,
                  stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
                },
                async () => {
                  if (compiler.options.mode !== 'production') {
                    return;
                  }
                  const { projectInfo, blockInfo } = await getConfigFiles();
                  compilation.emitAsset(
                    'project.config.json',
                    new compiler.webpack.sources.RawSource(JSON.stringify(projectInfo)),
                  );
                  compilation.emitAsset('index.json', new compiler.webpack.sources.RawSource(JSON.stringify(blockInfo)));
                },
              );
            });
          },
        });

        const originalSetupMiddlewares = config.devServer?.setupMiddlewares;
        config.devServer = config.devServer || {};
        config.devServer.setupMiddlewares = (middlewares: any[], devServer: any) => {
          const server = devServer?.app;
          if (server?.use) {
            let middlewarePromise: Promise<any> | null = null;
            server.use(async (req: any, res: any, next: any) => {
              try {
                const port = devServer?.options?.port ?? 8080;
                const url = await ensureInitialized(port);
                if (!middlewarePromise) {
                  middlewarePromise = createDocsAddonMiddleware(port);
                }
                const middleware = await middlewarePromise;
                res.setHeader('Access-Control-Allow-Origin', new URL(url).origin);
                res.setHeader('Access-Control-Allow-Methods', '*');
                res.setHeader('Access-Control-Allow-Headers', 'x-request-id');
                res.setHeader('Access-Control-Allow-Credentials', 'true');
                if (req.url?.startsWith(BASE_PATH)) {
                  return next();
                }
                middleware(
                  { url: req.url },
                  {
                    send: (content: unknown) => {
                      if (!content) {
                        return next();
                      }
                      res.end(Buffer.from(JSON.stringify(content)));
                    },
                  },
                  next,
                );
              } catch (error) {
                next(error);
              }
            });
          }
          if (typeof originalSetupMiddlewares === 'function') {
            return originalSetupMiddlewares(middlewares, devServer);
          }
          return middlewares;
        };

        return config;
      });
    },
  };
}
