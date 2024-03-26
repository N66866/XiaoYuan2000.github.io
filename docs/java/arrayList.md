# ArrayList
## ArrayList也这么多知识？
Array + List = 数组 + 列表 = ArrayList = 数组列表
### 初始化
```java
List<String> list = new ArrayList<String>(10);

public ArrayList() {
    this.elementData = DEFAULTCAPACITY_EMPTY_ELEMENTDATA;
}

 /**
  * Constructs an empty list with the specified initial capacity.
  *
  * @param  initialCapacity  the initial capacity of the list
  * @throws IllegalArgumentException if the specified initial capacity
  *         is negative
  */
 public ArrayList(int initialCapacity) {
     if (initialCapacity > 0) {
         this.elementData = new Object[initialCapacity];
     } else if (initialCapacity == 0) {
         this.elementData = EMPTY_ELEMENTDATA;
     } else {
         throw new IllegalArgumentException("Illegal Capacity: "+
                                            initialCapacity);
     }
 }
```
* 通常情况空构造函数初始化ArrayList更常用，这种方式数组的长度会在第一次插入数据时候进行设置。
* 当我们已经知道要填充多少个元素到ArrayList中，比如500个、1000个，那么为了提供性能，减少ArrayList中的拷贝操作，这个时候会直接初始化一个预先设定好的长度。
* 另外，EMPTY_ELEMENTDATA 是一个定义好的空对象；private static final Object[] EMPTY_ELEMENTDATA = {}

### 插入
ArrayList对元素的插入，其实就是对数组的操作，只不过需要特定时候扩容。
当我们依次插入添加元素时，ArrayList.add方法只是把元素记录到数组的各个位置上了，源码如下；
```java
/**
 * Appends the specified element to the end of this list.
 *
 * @param e element to be appended to this list
 * @return <tt>true</tt> (as specified by {@link Collection#add})
 */
public boolean add(E e) {
    ensureCapacityInternal(size + 1);  // Increments modCount!!
    elementData[size++] = e;
    return true;
}
```
这是插入元素时候的源码，size++自增，把对应元素添加进去。
#### 插入时扩容
在前面**初始化**部分讲到，ArrayList默认初始化时会申请10个长度的空间，如果超过这个长度则需要进行扩容，那么它是怎么扩容的呢？
从根本上分析来说，数组是定长的，如果超过原来定长长度，扩容则需要申请新的数组长度，并把原数组元素拷贝到新数组中，如下图；
![图片](/java/arraylist/interview-8-03.png)
图中介绍了当List结合可用空间长度不足时则需要扩容，这主要包括如下步骤；
1. 判断长度充足；ensureCapacityInternal(size + 1);
2. 当判断长度不足时，则通过扩大函数，进行扩容；grow(int minCapacity)
3. 扩容的长度计算；int newCapacity = oldCapacity + (oldCapacity >> 1);，旧容量 + 旧容量右移1位，这相当于扩容为原来容量的(int)3/2。 4. 10，扩容时：1010 + 1010 >> 1 = 1010 + 0101 = 10 + 5 = 15 2. 7，扩容时：0111 + 0111 >> 1 = 0111 + 0011 = 7 + 3 = 10
4. 当扩容完以后，就需要进行把数组中的数据拷贝到新数组中，这个过程会用到Arrays.copyOf(elementData, newCapacity);，但他的底层用到的是；System.arraycopy
```java
@Test
public void test_arraycopy() {
    int[] oldArr = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10};
    int[] newArr = new int[oldArr.length + (oldArr.length >> 1)];
    System.arraycopy(oldArr, 0, newArr, 0, oldArr.length);
    
    newArr[11] = 11;
    newArr[12] = 12;
    newArr[13] = 13;
    newArr[14] = 14;
    
    System.out.println("数组元素：" + JSON.toJSONString(newArr));
    System.out.println("数组长度：" + newArr.length);
    
    /**
     * 测试结果
     * 
     * 数组元素：[1,2,3,4,5,6,7,8,9,10,0,11,12,13,14]
     * 数组长度：15
     */
}
```
* 拷贝数组的过程并不复杂，主要是对System.arraycopy的操作。
* 上面就是把数组oldArr拷贝到newArr，同时新数组的长度，采用和ArrayList一样的计算逻辑；oldArr.length + (oldArr.length >> 1)
#### 指定位置插入
容量验证
```java
public void add(int index, E element) {
    rangeCheckForAdd(index);
    
    ...
}

private void rangeCheckForAdd(int index) {
    if (index > size || index < 0)
        throw new IndexOutOfBoundsException(outOfBoundsMsg(index));
}
```
* 指定位置插入首先要判断rangeCheckForAdd，size的长度。
* 通过上面的元素插入我们知道，每插入一个元素，size自增一次size++。
* 所以即使我们申请了10个容量长度的ArrayList，但是指定位置插入会依赖于size进行判断，所以会抛出IndexOutOfBoundsException异常。
#### 元素迁移
![图片](/java/arraylist/interview-8-04.png)
指定位置插入的核心步骤包括；
1. 判断size，是否可以插入。
2. 判断插入后是否需要扩容；ensureCapacityInternal(size + 1);。
3. 数据元素迁移，把从待插入位置后的元素，顺序往后迁移。
4. 给数组的指定位置赋值，也就是把待插入元素插入进来。
```java
public void add(int index, E element) {
	...
	// 判断是否需要扩容以及扩容操作
	ensureCapacityInternal(size + 1);
    // 数据拷贝迁移，把待插入位置空出来
    System.arraycopy(elementData, index, elementData, index + 1,
                     size - index);
    // 数据插入操作                  
    elementData[index] = element;
    size++;
}
```
* 这部分源码的主要核心是在，System.arraycopy，上面我们已经演示过相应的操作方式。
* 这里只是设定了指定位置的迁移，可以把上面的案例代码复制下来做测试验证。

### 删除
有了指定位置插入元素的经验，理解删除的过长就比较容易了，如下图；
![图片](/java/arraylist/interview-8-05.png)
```java
public E remove(int index) {
    rangeCheck(index);
    modCount++;
    E oldValue = elementData(index);
    int numMoved = size - index - 1;
    if (numMoved > 0)
        System.arraycopy(elementData, index+1, elementData, index,
                         numMoved);
    elementData[--size] = null; // clear to let GC do its work
    return oldValue;
}
```
删除的过程主要包括；
1. 校验是否越界；rangeCheck(index);
2. 计算删除元素的移动长度numMoved，并通过System.arraycopy自己把元素复制给自己。
3. 把结尾元素清空，null。