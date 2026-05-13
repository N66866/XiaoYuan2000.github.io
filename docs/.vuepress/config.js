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
                    {text: "中间件学习", link: "/middleware/"},
                    {text: "AI Agent 学习", link: "/agent/"}
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
                ],
                '/agent/': [
                    {
                        title: 'Agent 扫盲篇',
                        collapsable: true,
                        children: [
                            {title:'大模型基础扫盲',path:'/agent/llm-basics'},
                            {title:'API 调用与 Prompt 工程',path:'/agent/api-and-prompt'},
                            {title:'RAG 是什么',path:'/agent/rag-overview'},
                        ]
                    },
                    {
                        title: 'RAG 工程篇',
                        collapsable: true,
                        children: [
                            {title:'RAG 知识库入库',path:'/agent/rag-ingestion'},
                            {title:'Embedding 与向量数据库',path:'/agent/embedding-and-vector-db'},
                            {title:'检索策略与召回优化',path:'/agent/retrieval-optimization'},
                            {title:'大模型生成策略与幻觉抑制',path:'/agent/generation-and-hallucination'},
                            {title:'RAG 评估与优化',path:'/agent/rag-evaluation'},
                        ]
                    },
                    {
                        title: 'Agent 能力篇',
                        collapsable: true,
                        children: [
                            {title:'查询重写、意图路由与多轮记忆',path:'/agent/query-routing-and-memory'},
                            {title:'Function Calling 与工具调用',path:'/agent/function-calling'},
                            {title:'工具调用架构与安全保障',path:'/agent/tool-calling-architecture'},
                            {title:'SSE 协议与流式响应',path:'/agent/sse-streaming'},
                            {title:'MCP 协议入门',path:'/agent/mcp-basics'},
                            {title:'JSON-RPC 2.0 与 MCP 协议基础',path:'/agent/json-rpc-and-mcp-protocol'},
                        ]
                    },
                    {
                        title: 'Java Agent 开发篇',
                        collapsable: true,
                        children: [
                            {title:'Java Agent 开发落地提示',path:'/agent/java-agent-dev-notes'},
                        ]
                    }
                ]
            }
    },
};
