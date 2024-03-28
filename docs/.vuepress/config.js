module.exports = {
    title: "NULL学习笔记",
    description: "分享各类资源、教程、工具等等",
    markdown: {
        lineNumbers: true,
    },
    themeConfig: {
        lastUpdated: 'Last Updated', // 文档更新时间：每个文件git最后提交的时间
        nav: [
            {text: 'NULL主页', link: 'https://xiaoyuan.space'}, // 外部链接
            {
                text: '学习笔记', items: [
                    {text: "Java", link: "/java/"},
                    {text: "Spring", link: "/spring/"},
                    {text: "git", link: "/git/"},
                    {text: "技术实践", link: "/practice/"},
                    {text: "奇难杂症", link: "/cannot-understand/"},
                ]
            }, // 内部链接 以docs为根目录
            // 下拉列表
            {
                text: '已发布项目',
                items: [
                    {text: 'SaaS短链接', link: 'http://short-link.xiaoyuan.space'}
                ]
            }
        ],
        sidebarDepth: 2,
        search: true,
        searchMaxSuggestions: 10,
        displayAllHeaders: false,
        sidebar:
            {
                // docs文件夹下面的java文件夹 文档中md文件 书写的位置(命名随意)
                '/java/': [
                    //首页 java 目录下的README.md 等于是首页,必须要又README.md 不然404
                    //'/java/',
                    //自定目录
                    {
                        title: 'Java底层',
                        collapsable: true,
                        children: [
                            {title:'HashMap',path:'/java/hashMap'}, // 以docs为根目录来查找文件
                            {title:'ArrayList',path:'/java/arrayList'}, // 以docs为根目录来查找文件
                            {title:'queue',path:'/java/queue'}, // 以docs为根目录来查找文件
                            {title:'String',path:'/java/string'}, // 以docs为根目录来查找文件
                            {title:'ThreadLocal',path:'/java/ThreadLocal'}, // 以docs为根目录来查找文件
                            // 上面地址查找的是：docs>java>test.md 文件
                            // 自动加.md 每个子选项的标题 是该md文件中的第一个h1/h2/h3标题
                        ]
                    },
                    {
                        title:"Java并发编程",
                        collapsable: true,
                        children: [
                            {title:'proxy',path:'/java/proxy'}, // 以docs为根目录来查找文件
                            {title:'volatile',path:'/java/volatile'}, // 以docs为根目录来查找文件
                            {title:'synchronized',path:'/java/synchronized',sidebarDepth: 3}, // 以docs为根目录来查找文件
                            {title:'ReentrantLock',path:'/java/ReentrantLock',sidebarDepth: 3}, // 以docs为根目录来查找文件
                            {title:'AbstractQueuedSynchronizer',path:'/java/AQS',sidebarDepth: 3}, // 以docs为根目录来查找文件
                        ]
                    }
                ],
                '/git/': [
                   // '/git/',
                    {
                        title: 'git',
                        children: [
                            '/git/git'
                        ]
                    }
                ],
                '/practice/': [
                    // '/git/',
                    {
                        title: '技术实践',
                        children: [
                            {title:'CI/CD',path:'/practice/CI CD'}
                        ]
                    }
                ],
                '/cannot-understand/': [
                    // '/git/',
                    {
                        title: 'JAVA/Spring奇难杂症',
                        children: [
                            {title:'使用SpringUtil时发生的小问题',path:'/cannot-understand/springutil'}
                        ]
                    }
                ]
            }
    },
};
