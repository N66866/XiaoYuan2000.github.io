(window.webpackJsonp=window.webpackJsonp||[]).push([[48],{328:function(_,e,s){"use strict";s.r(e);var v=s(14),i=Object(v.a)({},(function(){var _=this,e=_._self._c;return e("ContentSlotsDistributor",{attrs:{"slot-key":_.$parent.slotKey}},[e("h2",{attrs:{id:"redis为什么这么快"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#redis为什么这么快"}},[_._v("#")]),_._v(" Redis为什么这么快")]),_._v(" "),e("p",[_._v("Redis 官方早前发布过一套基准测试，在 Redis 服务连接数小于 1 万时，并发数量每秒可以达到 10-12 万左右。连接数在 3-6万 时，也能支持每秒 5-6 万的并发。我也尝试用Redis自带的性能测试工具进行测试，单机2h2gQPS可以到达10w/s。\n我觉得 Redis 之所以操作这么快，主要有以下几方面原因：")]),_._v(" "),e("ul",[e("li",[_._v("从存储方式上看：Redis 是基于内存的数据库，而直接访问内存的速度要比访问磁盘高上几个数量级。这是 Redis 快最主要的原因。")]),_._v(" "),e("li",[_._v("从设计上看：Redis 在架构上采用了 IO 多路复用提高了资源利用率，通过多线程非阻塞式 IO 提高请求的处理效率，使用单线程执行大部分命令以避免上下文切换，部分重命令则允许异步执行，并且在设计上针对最底层的数据结构进行了精细的优化，以保证任何操作都具备尽可能低的复杂度。")]),_._v(" "),e("li",[_._v("从使用方式上看：Redis 的功能非常纯粹，用户直接面向经过精心设计的数据结构进行操作，因此效率极高，此外，用户还可以根据自己的业务场景采用最合适的数据结构，这也间接提高了操作效率。")])]),_._v(" "),e("h3",{attrs:{id:"基于内存操作"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#基于内存操作"}},[_._v("#")]),_._v(" 基于内存操作")]),_._v(" "),e("p",[_._v("Redis 是基于内存操作的数据库，这是它快的最根本原因。计算机组成原理一课中，我们得知操作速度内存 >> SSD >> HDD，Redis大多数时间只在内存中进行读写，只有少部分操作才会有磁盘交互(例如持久化)。")]),_._v(" "),e("h3",{attrs:{id:"合理的线程模型"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#合理的线程模型"}},[_._v("#")]),_._v(" 合理的线程模型")]),_._v(" "),e("p",[_._v("我们常说Redis是单线程的，实际上指的是Redis的操作命令主线程是单线程的。这个设计使得Redis避免了频繁的上下文切换导致不必要的性能消耗，同时也避免了为了支持并发操作要引入的锁机制等。")]),_._v(" "),e("blockquote",[e("p",[_._v("并且Redis官方也提到:CPU 并不是制约 Redis 性能表现的瓶颈所在，更多情况下是受到内存大小和网络I/O的限制，所以 Redis 核心网络模型使用单线程并没有什么问题，如果你想要使用服务的多核CPU，可以在一台服务器上启动多个节点或者采用分片集群的方式。")])]),_._v(" "),e("p",[_._v("不过，Redis从4.0开始，引入了"),e("code",[_._v("UNLINK")]),_._v("这类命令，用于异步执行删除等操作。\n并在 Redis 6.0 版本之后，也采用了多个 I/O 线程来处理网络请求，这是因为随着网络硬件的性能提升，Redis 的性能瓶颈有时会出现在网络 I/O 的处理上。但是对于命令的执行，Redis 仍然使用单线程来处理\nRedis 官方表示，Redis 6.0 版本引入的多线程 I/O 特性对性能提升至少是一倍以上。")]),_._v(" "),e("blockquote",[e("p",[_._v("小林coding提到："),e("img",{attrs:{src:"/middleware/redis/IMG_2299.PNG",alt:"pic"}})])]),_._v(" "),e("blockquote",[e("p",[_._v("这里我们要顺带强调一下，虽然 Redis 的单个主线程模型确实带来的不少的好处，但是这个设计更多的还是在性能与设计之间取得的一个平衡。实际上不少市面上开源或者大公司内部自研的 KV 数据库 —— 比如 KeyDB 或者  Dragonfly —— 都是基于多线程模型实现的，它们以单机模式运行在多核机器上时也确实表现出了比 Redis 更高的性能。")])]),_._v(" "),e("h3",{attrs:{id:"高效的io模型"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#高效的io模型"}},[_._v("#")]),_._v(" 高效的io模型")]),_._v(" "),e("h4",{attrs:{id:"io多路复用"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#io多路复用"}},[_._v("#")]),_._v(" IO多路复用")]),_._v(" "),e("p",[_._v("这里用到小林coding的图："),e("br"),_._v(" "),e("img",{attrs:{src:"/middleware/Redis/redis%E5%8D%95%E7%BA%BF%E7%A8%8B%E6%A8%A1%E5%9E%8B.drawio.webp",alt:"pic"}})]),_._v(" "),e("p",[_._v("为了提高资源利用率，提高服务吞吐量，Redis 在内部实现了一套网络事件库，它支持基于 Solaris 中的 evport、Linux 中的 epoll、Mac OS/FreeBSD 中的 kQueue ……等操作系统函数实现高效的 IO 多路复用。\n在这个模型中，它将会来自客户端的网络请求作为一个事件发布到队列中，然后线程将同步的获取事件并派发到不同的处理器，而处理器处理完毕后又会再发布另一个事件……整个主流程都由 Redis 的主线程在一个不间断的循环中完成，这就是事件循环。")]),_._v(" "),e("h4",{attrs:{id:"多线程非阻塞式io"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#多线程非阻塞式io"}},[_._v("#")]),_._v(" 多线程非阻塞式IO")]),_._v(" "),e("p",[_._v("这里用大话面试的图："),e("br"),_._v(" "),e("img",{attrs:{src:"/middleware/Redis/%E5%A4%A7%E8%AF%9D%E9%9D%A2%E8%AF%95-01.png",alt:"pic"}})]),_._v(" "),e("p",[_._v("随着请求规模的扩大，单个线程在网络 IO 上消耗的 CPU 时间越来越多，它逐渐成为了 Redis 的性能瓶颈。因此在 6.0 版及以上版本，Redis 正式引入了多线程来处理网络 IO。\n在新的版本中，Redis 依然使用单个主线程来执行命令，但是使用多个线程来处理 IO 请求，主线程不再负责包括建立连接、读取数据和回写数据这些事情，而只是专注于执行命令。\n这个做法在保证单注线程设计的原有优点的情况下，又进一步提高了网络 IO 的处理效率。")]),_._v(" "),e("h3",{attrs:{id:"数据结构"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#数据结构"}},[_._v("#")]),_._v(" 数据结构")]),_._v(" "),e("p",[_._v("Redis常见数据类型有九种：")]),_._v(" "),e("ol",[e("li",[_._v("String 字符串 -> 采用了SDS 即简单字符串的底层数据库结构")]),_._v(" "),e("li",[_._v("Hash 哈希 -> 采用了"),e("a",{attrs:{href:"#Redis%E7%9A%84%E5%8E%8B%E7%BC%A9%E5%88%97%E8%A1%A8"}},[_._v("压缩列表")]),_._v("或"),e("a",{attrs:{href:"#Redis%E7%9A%84%E8%B7%B3%E8%A1%A8"}},[_._v("跳表")]),_._v("来实现。\n"),e("ul",[e("li",[_._v("元素个数少于512(默认,可由"),e("code",[_._v("hash-max-ziplist-entreies")]),_._v("配置)，所有值都小于 64 字节（默认值，可由 hash-max-ziplist-value 配置）的话，Redis 会使用压缩列表作为 Hash 类型的底层数据结构")]),_._v(" "),e("li",[_._v("如果哈希类型元素不满足上面条件，Redis 会使用哈希表作为 Hash 类型的 底层数据结构。")]),_._v(" "),e("li",[_._v("在 Redis 7.0 中，压缩列表数据结构已经废弃了，交由 listpack 数据结构来实现了")])])]),_._v(" "),e("li",[_._v("Set 集合 -> 采用了哈希表或整数集合实现的\n"),e("ul",[e("li",[_._v("如果集合中的元素都是整数且元素个数小于 512(默认值，set-maxintset-entries配置)Redis 会使用整数集合作为 Set 类型的底层数据结构")]),_._v(" "),e("li",[_._v("如果集合中的元素不满足上面条件，则 Redis 使用哈希表作为 Set 类型的底层数据结构")])])]),_._v(" "),e("li",[_._v("ZSet 有序集合 -> 采用了"),e("a",{attrs:{href:"#Redis%E7%9A%84%E5%8E%8B%E7%BC%A9%E5%88%97%E8%A1%A8"}},[_._v("压缩列表")]),_._v("或"),e("a",{attrs:{href:"#Redis%E7%9A%84%E8%B7%B3%E8%A1%A8"}},[_._v("跳表")]),_._v("来实现。\n"),e("ul",[e("li",[_._v("如果有序集合的元素个数小于 128个，并且每个元素的值小于 64 字节时，Redis 会使用压缩列表作为 Zset 类型的底层数据结构")]),_._v(" "),e("li",[_._v("如果有序集合的元素不满足上面的条件，Redis 会使用跳表作为 Zset 类型的底层数据结构")]),_._v(" "),e("li",[_._v("在 Redis 7.0 中，压缩列表数据结构已经废弃了，交由 listpack 数据结构来实现了")])])]),_._v(" "),e("li",[_._v("List 列表 -> 采用了"),e("a",{attrs:{href:"#Redis%E7%9A%84%E5%8E%8B%E7%BC%A9%E5%88%97%E8%A1%A8"}},[_._v("压缩列表")]),_._v(" "),e("ul",[e("li",[_._v("在 Redis 7.0 中，压缩列表数据结构已经废弃了，交由 listpack 数据结构来实现了")])])]),_._v(" "),e("li",[_._v("BitMap 位图")]),_._v(" "),e("li",[_._v("HyperLogLog 统计用的")]),_._v(" "),e("li",[_._v("GEO 地理位置")]),_._v(" "),e("li",[_._v("Stream 队列")])]),_._v(" "),e("p",[_._v("Redis 的高性能很大程度上依赖于它丰富而高效的数据结构，而它们在底层实现上，都针对不同的使用场景进行了精心的设计和优化。")]),_._v(" "),e("h2",{attrs:{id:"redis字符串底层数据结构"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#redis字符串底层数据结构"}},[_._v("#")]),_._v(" Redis字符串底层数据结构")]),_._v(" "),e("p",[_._v("在 Redis 中，没有使用 C 标准库提供的字符串(C语言的字符串其实就是一个字符数组，即数组中每个元素是字符串中的一个字符。以\\0结尾，表示字符串结束)，而是实现了一种名为简单动态字符串（SDS, Simple Dynamic String）的数据结构来表示字符串。"),e("br"),_._v(" "),e("img",{attrs:{src:"/middleware/Redis/516738c4058cdf9109e40a7812ef4239.webp",alt:"pic"}}),e("br"),_._v("\nSDS 由长度（len）、内存空间大小（alloc）、字符串类型（flags）和存储的字节数组（buf）四个部分组成。相较于 C 标准库的字符串，它具备以下优点：")]),_._v(" "),e("ul",[e("li",[_._v("高效的长度计算：SDS 记录了字符串长度，因此获取字符串长度时可直接返回，无需遍历每个字符。")]),_._v(" "),e("li",[_._v("二进制安全：SDS 不需要根据 \\0 特色字符判断字符串是否已经结束，因此可存储任何二进制数据，无需担心因为特殊字符引发异常。")]),_._v(" "),e("li",[_._v("高效修改的操作：SDS 记录了内存空间大小，因此写入时可计算剩余空间并决定是否自动扩容，结合追加字符串时的空间预分配和截取字符串时的惰性删除策略，最大程度的减少了修改时的内存重新分配次数。")]),_._v(" "),e("li",[_._v("节省内存：Redis 设计了五种不同类型的 SDS，每种对应某一大小范围的字符串，因此可以根据字符串的大小选择占用空间最少的 SDS 类型，并且不使用编译器的内存对齐，而是按实际大小分配内存。最大程度节省了内存。")])]),_._v(" "),e("h3",{attrs:{id:"_1-高效的长度计算"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#_1-高效的长度计算"}},[_._v("#")]),_._v(" 1. 高效的长度计算")]),_._v(" "),e("p",[_._v("对于 C 标准库 string.h 的字符串使用 char* 字符串数值记录字符，由于没有一个具体的长度，因此使用时需要遍历每一个字符，直到特殊字符 \\0 为止。\nRedis 使用一个额外的 len 属性来记录字符串的具体长度，所以当获取字符串长度时不必每次都要遍历数组。")]),_._v(" "),e("h3",{attrs:{id:"_2-二进制安全"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#_2-二进制安全"}},[_._v("#")]),_._v(" 2. 二进制安全")]),_._v(" "),e("p",[_._v("由于 C 标准库中的字符串使用 \\0 作为结束符号，因此当把其他数据转而二进制存储时，就可能有可能因为在字符串中出现 \\0 导致读取数据时提前结束。\n而 Redis 不需要根据 \\0 去判断字符串是否结束，因此它可以将任何数据转为二进制存储。\n不过，为了兼容 C 标准库的一些操作，Redis 仍然为数组末尾的 \\0 预留了内存空间。")]),_._v(" "),e("h3",{attrs:{id:"_3-高效的修改操作"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#_3-高效的修改操作"}},[_._v("#")]),_._v(" 3. 高效的修改操作")]),_._v(" "),e("p",[_._v("对于在 C 标准库的字符串，当我们进行修改操作的时候，可能需要频繁的重新分配内存大小。\nRedis 的 SDS 除了使用 len 来记录字符串长度外，还使用 alloc 变量来记录字符串的分配到的内存大小，当修改字符串时，使用两值计算即可得知当前空间是否足够，并确认是否需要/不需要扩容。\n当对字符串进行修改时，Redis 会根据修改后使用的空间大小，对 SDS 预分配额外的内存空间，一般来说，当其操作后的字符串大小 < 1MB，那么将会额外分配一倍的未使用内存，若 > 1MB，那么将会额外分配 1MB 内存。\n并且，当截取字符串时，Redis 不会立即释放字符串的内存空间，而是等到相关操作结束后再进行释放。\n上述措施最大化的保证当频繁操作字符串时，不会因为额外的内存分配操作而影响性能。")]),_._v(" "),e("blockquote",[e("p",[_._v("在 3.2 及更早版本，Redis 使用 free 来记录未使用的内存大小，后面改为使用 alloc 记录已分配的总内存大小。")])]),_._v(" "),e("h3",{attrs:{id:"_4-节省内存"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#_4-节省内存"}},[_._v("#")]),_._v(" 4. 节省内存")]),_._v(" "),e("p",[_._v("在 Redis 中， SDS 共有 sdshdr5、sdshdr8、sdshdr16、sdshdr32 与 sdshdr64 五种字符串，它们分别对应存储长度小于等于 2 的 5/8/16/32/64 次方字节的字符串。flags 属性则用于区分它们的属于哪种 SDS。"),e("br"),_._v("\n不同的 SDS 的 len 和 alloc 长度不同，比如 sdshdr32 中两者的长度类型为 uint32，而 sdshdr5 甚至直接使用 flags 的高 5 位存储长度，低 3 位存储类型。"),e("br"),_._v("\n此外，默认情况下编译器会使用内存对齐的方式分配内存，也就是说，编译器在为同一个结构体中的变量分配内存时，不会按实际大小分配内存，而是会为其分配额外的内存，保证最终每个成员变量分配的内存大小都为最大变量的整倍数，从而保证所有成员尽可能在内存中相邻。"),e("br"),_._v("\nRedis 使用 "),e("strong",[_._v("attribute")]),_._v(" (("),e("strong",[_._v("packed")]),_._v(")) 让编译器取消内存对齐，从而保证按实际大小分配内存，从而节约内存。\n其中：Redis 的 SDS 结构保持了内存对齐（使用 "),e("strong",[_._v("attribute")]),_._v(" (("),e("strong",[_._v("aligned")]),_._v("))），因为这是一个被频繁访问的基础数据结构，对齐可以提高访问效率。"),e("br"),_._v("\nRedis 只在一些特定的数据结构（如 ziplist）中使用 "),e("strong",[_._v("attribute")]),_._v(" (("),e("strong",[_._v("packed")]),_._v(")) 属性来取消内存对齐以节省内存。")]),_._v(" "),e("h2",{attrs:{id:"redis的压缩列表与紧凑列表"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#redis的压缩列表与紧凑列表"}},[_._v("#")]),_._v(" Redis的压缩列表与紧凑列表")]),_._v(" "),e("p",[e("img",{attrs:{src:"/middleware/Redis/%E5%A4%A7%E8%AF%9D%E9%9D%A2%E8%AF%95-02.png",alt:"pic"}}),e("br"),_._v("\nRedis 的压缩列表是List、Hash 和 ZSet 这三种数据结构的底层实现之一。它由一段连续的内存块组成，每一小段内存都对应一个节点。相对传统的链表，它不使用指针而使用内存偏移量记录节点间的相对关系。")]),_._v(" "),e("h3",{attrs:{id:"_1-特点-结构特点"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#_1-特点-结构特点"}},[_._v("#")]),_._v(" 1. 特点：结构特点")]),_._v(" "),e("p",[_._v("压缩列表的头部记录了占用内存大小、尾节点位置与节点总数，而每个节点都记录了上一节点长度、编码格式和数据。这种简洁而紧凑的结构使其可以使用尽可能小的内存存尽可能多的数据，并且仍具备传统链表的正向与逆向遍历功能。"),e("br"),_._v(" "),e("img",{attrs:{src:"/middleware/Redis/a3b1f6235cf0587115b21312fe60289c.webp",alt:"pic"}})]),_._v(" "),e("ol",[e("li",[_._v("压缩列表在头部记录了三个属性：")])]),_._v(" "),e("ul",[e("li",[_._v("列表大小（zlbytes ），即整段列表在内存中占用的字节数。")]),_._v(" "),e("li",[_._v("尾节点位置（zltail），也就是从队列头到最后一个节点起始位置的内存偏 en 移量。")]),_._v(" "),e("li",[_._v("节点数量（zllen），即总共有多少个节点。")])]),_._v(" "),e("ol",{attrs:{start:"2"}},[e("li",[_._v("而每个节点中又可以划分为三个部分：")])]),_._v(" "),e("ul",[e("li",[_._v("上一节点长度（prelen），用于倒序遍历时确认上一节点的起始位置。")]),_._v(" "),e("li",[_._v("节点编码（encoding），它同时记录了长度和编码类型。")]),_._v(" "),e("li",[_._v("数据（data）。")])]),_._v(" "),e("ol",{attrs:{start:"3"}},[e("li",[_._v("相比起传统的链表，压缩列表最大优点就是节省内存：")])]),_._v(" "),e("ul",[e("li",[_._v("由于数据存储在一段连续的内存空间，所以它的结构十分紧凑；")]),_._v(" "),e("li",[_._v("由于使用了内存偏移量替代了链表中的指针，因此在保留正序和倒序遍历能力的同时，更节省内存；")]),_._v(" "),e("li",[_._v("由于每个节点都记录了编码，因此能针对每个节点的类型而使用最节省内存的内存分配方案；")])]),_._v(" "),e("h3",{attrs:{id:"_2-缺陷-连锁更新"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#_2-缺陷-连锁更新"}},[_._v("#")]),_._v(" 2. 缺陷：连锁更新")]),_._v(" "),e("p",[_._v("压缩列表的最大问题在于，当修改节点时需要一并修改后继节点记录的前驱节点的长度，当长度超过编码类型所支持的最大数值时，后继节点也需要重新分配内存以改变编码类型。依次类推，就会导致连锁更新。"),e("br"),_._v("\n压缩列表的缺点也非常明显，那就是修改成本高：")]),_._v(" "),e("ol",[e("li",[_._v("由于后继节点会在 prelen 记录的前驱节点的长度，因此当前驱节点修改后，后继节点就需要修改prelen；")]),_._v(" "),e("li",[_._v("当prelen 超过当前类型编码的最大大小时，就需要改变编码类型，并重新分配内存；")]),_._v(" "),e("li",[_._v("后继节点重新分配内存后，其后继节点同样面临一样的情况，如此反复，从而可能引发连锁更新。\n综上考虑，Redis 一般仅在存储少量小数据的时候才会使用压缩列表，而数据比较多或者比较大的时候就会换成其他数据结构。")])]),_._v(" "),e("h3",{attrs:{id:"_3-替代-紧凑列表"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#_3-替代-紧凑列表"}},[_._v("#")]),_._v(" 3. 替代：紧凑列表")]),_._v(" "),e("p",[_._v("为了解决连锁更新问题，Redis 在后续计划引入紧凑列表（listpack）替代压缩列表。它与压缩列表一样，都是基于一块连续的内存实现的有序列表，但是它的节点只记录当前节点的长度，而不记录前驱节点长度。因此修改节点并不会触发连锁更新。"),e("br"),_._v(" "),e("img",{attrs:{src:"/middleware/Redis/c5fb0a602d4caaca37ff0357f05b0abf.webp",alt:"pic"}}),_._v("\n紧凑列表在头部记录了两个属性：")]),_._v(" "),e("ul",[e("li",[_._v("列表大小（total），即整段列表在内存中占用的字节数。")]),_._v(" "),e("li",[_._v("节点数量（num），即总共有多少个节点。\n它的节点则包括三个部分：")]),_._v(" "),e("li",[_._v("节点长度（len），即 encoding + data 的总长度。正向或反向遍历依赖它完成。")]),_._v(" "),e("li",[_._v("节点编码（encoding）节点的编码类型。")]),_._v(" "),e("li",[_._v("数据（data）。")])]),_._v(" "),e("h2",{attrs:{id:"redis的跳表"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#redis的跳表"}},[_._v("#")]),_._v(" Redis的跳表")]),_._v(" "),e("h3",{attrs:{id:"_1-什么是跳表"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#_1-什么是跳表"}},[_._v("#")]),_._v(" 1. 什么是跳表？")]),_._v(" "),e("p",[_._v("Redis 只有 Zset 对象的底层实现用到了跳表，跳表的优势是能支持平均 O(logN) 复杂度的节点查找。"),e("br"),_._v("\n跳表在传统链表的基础上，额外添加了多层的索引表，每一层索引表都是原始原始链表的子集，它们只包含原始链表的一部分元素元素。\n当查找时，从顶层链表开始，逐层向下跳跃，直到找到元素或者找到一个接近目标元素的位置，然后再在底层链表中线性查找。"),e("br"),_._v(" "),e("img",{attrs:{src:"/middleware/Redis/Skip_list_add_element-en.gif",alt:"pic"}})]),_._v(" "),e("p",[_._v("以上图为例，现有 30 到 90 共六个元素，我们分别为其建立三级索引，每一级索引包含的原始数量从上到下依次增加。当我们插入一个元素 80 的时候：")]),_._v(" "),e("ol",[e("li",[_._v("检查第四层链表，找到离 80 最接近的 30；")]),_._v(" "),e("li",[_._v("从 30 向下进入第三层链表，找到离 80 最近的 50；")]),_._v(" "),e("li",[_._v("从 50 向下进入第二层链表，找到离 80 最近的 70；")]),_._v(" "),e("li",[_._v("从 70 进入第一层链表，发现 70 以后就是 90，于是直接插入 80；\n查询的流程也是一样的。当节点数量比较多时，跳表能够大幅度的提高查询效率。")])]),_._v(" "),e("h3",{attrs:{id:"_2-数据结构"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#_2-数据结构"}},[_._v("#")]),_._v(" 2. 数据结构")]),_._v(" "),e("p",[_._v("跳表具有四个属性：")]),_._v(" "),e("ul",[e("li",[_._v("header：指向头节点的指针。")]),_._v(" "),e("li",[_._v("tail：指向尾节点的指针。")]),_._v(" "),e("li",[_._v("level：跳表的最大层数。")]),_._v(" "),e("li",[_._v("length：跳表的长度。"),e("br"),_._v("\n而跳表中的节点则具有四个属性：")]),_._v(" "),e("li",[_._v("level：节点的层，该结构体包含两个属性：\n"),e("ul",[e("li",[_._v("forward：指向下一节点的前进指针。")]),_._v(" "),e("li",[_._v("span：下一节点与当前节点之间的跨度。")])])]),_._v(" "),e("li",[_._v("backward：指向前一个节点的指针，用于逆向遍历。")]),_._v(" "),e("li",[_._v("score：即 ZSet 中的分数 score，通过比较分数可以确定节点之间的先后顺序。")]),_._v(" "),e("li",[_._v("obj：指向成员 member 的指针。")])]),_._v(" "),e("p",[_._v("跳表是在链表基础上改进过来的，实现了一种「多层」的有序链表\n"),e("img",{attrs:{src:"/middleware/Redis/2ae0ed790c7e7403f215acb2bd82e884.webp",alt:"pic"}})]),_._v(" "),e("h3",{attrs:{id:"_3-数据的保存方式"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#_3-数据的保存方式"}},[_._v("#")]),_._v(" 3. 数据的保存方式")]),_._v(" "),e("p",[_._v("跳表使用 "),e("code",[_._v("obj")]),_._v(" 指针来指向 member，使用 socre 保存分值，同时又使用了字典来保存成员 member 和 score之间的映射关系，两者共享相同的 member 对象，因此即使同时使用了两种数据结构，也只占用一份内存。"),e("br"),_._v("\n正因如此，实际上有序集合 ZSet 的底层实现其实同时包括三种数据结构：字典、跳表和压缩列表。"),e("br"),_._v("\n当使用压缩列表时，score 和 member 都保存在列表的节点中。而当使用跳表时，除了在跳表的节点中记录 score 和 member（的指针）外，还额外在字典值记录的 member 与 score 的映射关系。")]),_._v(" "),e("h3",{attrs:{id:"_4-score相同"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#_4-score相同"}},[_._v("#")]),_._v(" 4. score相同")]),_._v(" "),e("p",[e("img",{attrs:{src:"/middleware/Redis/20241211154952.png",alt:"pic"}}),_._v('\n在跳表中，如果出现多个具有相同 score 的 member，即 score 相同的情况，Redis 将根据 member 的字典顺序来确定它们在跳表中的位置顺序。\n比如，如果向一个 ZSet 同时添加了三个 score 为 4 的字符串 "b"，"a"，"c"，那么在跳表中会有三个 score 为 4的节点。然后，根据 member 的字典排序结果，最终它们在跳表中的顺序会是 "a"，"b"，"c"。\n在跳表中，节点的顺序实际上就是排位，当执行诸如 '),e("code",[_._v("ZRANK")]),_._v(" 等排位相关命令时，会按照这个顺序来操作。\n关于字典排序的顺序，可以简单理解为按照 ASCII 码进行排序，首先是 0-9，然后是 A-Z，最后是 a-z。")]),_._v(" "),e("h3",{attrs:{id:"_5-如何建立索引"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#_5-如何建立索引"}},[_._v("#")]),_._v(" 5. 如何建立索引?")]),_._v(" "),e("p",[_._v("理想情况下，我们会希望每一层索引中的节点数量都是下一层的一半，即相邻两层节点数量之比为 2:1。这样就可以保证查找的复杂度为 O(logN)，相当于二分查找。\n不过，如果想要实现这一点，必然会导致需要额外的开销来频繁更新索引。因此，Redis 选择通过一种随机算法在创建节点时生成层数：")]),_._v(" "),e("ol",[e("li",[_._v("生成一个介于 0 到 1 之间的随机数，如果该随机数小于 0.25，就加一层；")]),_._v(" "),e("li",[_._v("重复上述步骤，直到随机数大于 0.25 ，或者当前层数已经达到最大值为止（最新版本最大层数为 32）；\n这种策略的巧妙之处在于，随着次数的增加，连续掷出小于 0.25 的概率会越来越小，因此高层节点会相对较少，而底层节点会相对较多，从而保证了索引的节点密度会随着层级从底层往上逐渐减少。\n为了便于理解，我们可以简单粗暴的认为，层高为 2 的节点出现的概率是 0.25，而层高为 3 的节点出现的概率为 0.25 * 0.25……以此类推。当然，实际上概率肯定不是这么算的，不过当层数越高，则此类节点出现的概率越低，这一点的没错的。")])]),_._v(" "),e("h3",{attrs:{id:"_6-为何不用平衡树"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#_6-为何不用平衡树"}},[_._v("#")]),_._v(" 6. 为何不用平衡树?")]),_._v(" "),e("ul",[e("li",[_._v("节省内存：跳表相比于树占用的内存较少，而且还可以通过调整层级生成的随机数来平衡索引效率和内存占用。")]),_._v(" "),e("li",[_._v("对范围操作支持友好：ZSet 经常需要进行诸如 ZRANGE 或 ZREVRANGE 这种范围操作，跳表在这方面操作的效率不比平衡树差。")]),_._v(" "),e("li",[_._v("修改操作的代价小：平衡树在修改后需要重新平衡，而跳表的效率更高。")]),_._v(" "),e("li",[_._v("实现简单：跳表相比树的实现更为简单")])])])}),[],!1,null,null,null);e.default=i.exports}}]);