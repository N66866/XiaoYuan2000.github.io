module.exports = {
  title: "NULL学习笔记",
  description: "分享各类资源、教程、工具等等",
  markdown: {
    lineNumbers: true,
  },
  themeConfig: {
    lastUpdated: 'Last Updated', // 文档更新时间：每个文件git最后提交的时间
    nav:[
      { text: 'NULL主页', link: 'https://xiaoyuan.space' }, // 外部链接
      { text: '学习笔记',items: [
          {text: "Java" , link:"/java/"},
          {text: "Spring" , link:"/spring/"},
          {text: "待更新" , link:"/"},
        ] }, // 内部链接 以docs为根目录
      // 下拉列表
      {
        text: '已发布项目',
        items: [
          { text: 'SaaS短链接', link: 'http://short-link.xiaoyuan.space' }
        ]
      }
    ],
    sidebarDepth: 2,
    search:true,
    searchMaxSuggestions:10,
    sidebar:
        {
      // docs文件夹下面的java文件夹 文档中md文件 书写的位置(命名随意)
      '/java/': [
          //首页 java 目录下的README.md 等于是首页
        '/java/',
          //自定目录
        {
          title: 'Java数据结构基础',
          children: [
            '/java/alg', // 以docs为根目录来查找文件
            // 上面地址查找的是：docs>java>test.md 文件
            // 自动加.md 每个子选项的标题 是该md文件中的第一个h1/h2/h3标题
          ]
        }
      ],
    }
  },
};