# block-docs-addon-vite-utils
[飞书云文档小组件](https://open.feishu.cn/document/client-docs/docs-add-on/docs-add-on-introduction) vite / rsbuild 支持。

本项目由官方 SDK [@lark-opdev/block-docs-addon-webpack-utils
](https://www.npmjs.com/package/@lark-opdev/block-docs-addon-webpack-utils) 转写而来（尽管原项目并未直接开源，但是在 npm 上附了 [MIT LICENSE](https://www.npmjs.com/package/@lark-opdev/block-docs-addon-webpack-utils/v/1.0.0?activeTab=code)，因此至少当前版本的发布是得到许可的），尽量在保持和官方代码相同的情况下实现对 vite 的支持。

## Vite
```ts
import { docVerseVitePlugin } from 'block-docs-addon-vite-utils';

export default {
  plugins: [docVerseVitePlugin()],
};
```

## Rsbuild
```ts
import { docVerseRsbuildPlugin } from 'block-docs-addon-vite-utils';

export default {
  plugins: [docVerseRsbuildPlugin()],
};
```

## Note
由于作者不在字节跳动工作，因此关于 eden 的部分无法转写或进行任何测试，但是本项目经过测试可以用于 vite 开发云文档小组件。
