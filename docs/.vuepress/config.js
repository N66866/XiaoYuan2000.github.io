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
                    {text: "中间件学习", link: "/middleware/"}
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
        sidebarDepth: 3,
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
                            {title:'AQS Share Lock',path:'/java/AQS-Share',sidebarDepth: 3}, // 以docs为根目录来查找文件
                        ]
                    },
                    {
                        title:"Java多线程",
                        collapsable: true,
                        children: [
                            {title:'Thread',path: '/java/thread'},
                            {title:'ThreadPoolExecutor',path: '/java/ThreadPoolExecutor'},
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
                            {title:'CI/CD',path:'/practice/CI CD'},
                            {title:'Spring中间件开发-分库分表',path:'/practice/db-router'},
                            {title:'Springboot内嵌artemis MQ',path:'/practice/spring-embedded-artemis'},
                        ]
                    }
                ],
                '/cannot-understand/': [
                    // '/git/',
                    {
                        title: '奇难杂症',
                        children: [
                            {title:'使用SpringUtil时发生的小问题',path:'/cannot-understand/springutil'},
                            {title:'shardingsphere读取配置问题',path:'/cannot-understand/shardingsphere'},
                            {title:'xface600产品掉线问题',path:'/cannot-understand/xface'},
                            {title:'cloudflare泛播问题',path:'/cannot-understand/cloudflare'},
                            {title:'jwt token 解析问题',path:'/cannot-understand/jwt-token-decode'},
                            {title:'t-io+java aio假死问题',path:'/cannot-understand/t-io_java_aio-dead'},
                        ]
                    }
                ],
                '/spring':[
                    {
                        title: 'Spring',
                        children: [
                            '/spring/Spring-registerBean',
                            '/spring/beanFactory&factoryBean',
                            '/spring/spring-start',
                        ]
                    }
                ],
                '/middleware':[
                    {
                        title: 'spring集成中间件',
                        children: [
                            '/middleware/spring-kafka',
                            '/middleware/xxl-job'
                        ]
                    },
                    {
                        title: '系统中间件',
                        children: [
                            '/middleware/docker',
                            '/middleware/kafka',
		{title:'Redis',path:'/middleware/redis'},
                        ]
                    }
                ]
            }
    },
};
