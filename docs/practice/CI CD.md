# CI/CD
## GithubPages CI/CD
最近本读书笔记网站部署时突发奇想，想着部署到Github pages并使用Github Actions实现自动化部署，我提交代码就自动更新到Github pages岂不美哉？
于是有了以下步骤（省略github注册、仓库推送等）

1. 进入github仓库的 actions  
![pic](/practice/CICD/github-pages-01.png)  

---
2. 然后点击new workflow，再点击如图的configure
![pic](/practice/CICD/github-pages-02.png)   

---
3. 把以下脚本复制粘贴进去，会有对应注释解释脚本含义
```yaml
# This is a basic workflow to help you get started with Actions
name:  Deploy Pages #脚本名称

on:
  push:
    branches:
      - master # 这里只配置了master分支，所以只有推送master分支才会触发以下任务

jobs:
  pages:
    runs-on: ubuntu-latest #基于ubuntu跑该脚本
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v2 #使用官方提供的拉取分支脚本

      - name: Use Node.js 16.20.0 #指定步骤名字
        uses: actions/setup-node@v2 #使用官方提供的脚本
        with:
          node-version: "16.20.0" #（可选）指定该步骤要使用的版本

      - name: Cache NPM dependencies #将 node_modules 缓存下来
        uses: actions/cache@v2
        with:
          path: node_modules
          key: ${{ runner.OS }}-npm-cache
          restore-keys: |
            ${{ runner.OS }}-npm-cache

      - name: Install Dependencies #安装依赖
        run: npm install
      - name: Build #执行package.json中的打包脚本 如果你package.json没写打包命令的话 需要写一下
        run: npm run build
      - name: Deploy #部署 这里调用别人提供的推送脚本
        uses: peaceiris/actions-gh-pages@v3
        with: # 参数配置
          github_token: ${{ secrets.你的密钥名 }}  #在第四步骤说明
          publish_dir: ./docs/.vuepress/dist #将打包后哪个文件/文件夹 推送上分支，会推送到 gh-pages分支
```
---
4. **github_token: secrets.你的密钥名** 配置，点击新建仓库秘钥，名字随便取，跟前文的'你的密钥名'相同即可，至于里面的SCRECT就填写申请的秘钥，将在下一步讲解（可以先随便填写保存，后面申请秘钥后再修改即可）
![pic](/practice/CICD/github-pages-03.png)  

---
5. 如图进入开发者设置，  
![pic](/practice/CICD/github-pages-04.png)  
导航选择Token(classic)，然后生成秘钥即可，过期时间最多选一年/永久。生成秘钥完成后复制到第四步即可。
![pic](/practice/CICD/github-pages-05.png)  

---
6. 至此github pages的自动化部署配置已完成，可以推送一下代码至g仓库的master尝试一下自动化部署效果了。部署成功的话，会新建一个gh-pages分支。

---
7. 最后在github pages页面选择gh-pages分支显示即可。
![pic](/practice/CICD/github-pages-06.png)  

 * 使用github域名：将仓库名字改为<自己的用户名>.github.io，就能用<自己的用户名>.github.io直接访问该github pages。
 * 自定义域名，在第七步的配置页里，Custom domain填写自己的域名，然后到自己的域名DNS解析一下到该github pages即可。