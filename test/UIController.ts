import TimeAxis from '../modules/core/TimeAxis.js';
import MapLoader from '../modules/loaders/MapLoader.js';
import DynamicRenderer from '../modules/renderers/DynamicRender.js';
import StaticRenderer from '../modules/renderers/StaticRenderer.js';
import { OrbitControls } from '../node_modules/three/examples/jsm/controls/OrbitControls.js';


class LoadingUI {
  /**
   * 更新加载提示
   * @param text - 要拼接在原文本后的加载提示信息
   * @param append - 提示更新模式（可选），为true时表示新增信息，默认或false为替换原信息
   */
  static updateTip(text: string, append = false): void {
    const tip: HTMLElement = document.querySelector('#progress-tip') as HTMLElement;
    tip.innerText = append ? tip.innerText + text : text;
  }

  static initUI(): void {
    /** 初始化地图选择窗口 */
    function mapSelector(): void {
      const chapterNodes = document.querySelectorAll('.chapter'); // 章节节点展开当前及关闭其他节点
      chapterNodes.forEach((node: Element) => {
        node.addEventListener('click', () => {
          const otherMapItemNode: HTMLElement | null = document.querySelector('.map-item.map-item-clicked'); // 其他展开的节点
          const thisMapItemNode: HTMLElement | null = node.querySelector('.map-item'); // 当前点击的节点
          if (otherMapItemNode && otherMapItemNode !== thisMapItemNode) {
            otherMapItemNode.classList.remove('map-item-clicked');
            const otherChapterNode = otherMapItemNode.parentNode as HTMLElement;
            otherChapterNode.style.cursor = '';
          }
          if (thisMapItemNode) {
            thisMapItemNode.classList.add('map-item-clicked');
            const { style } = node as HTMLElement;
            style.cursor = 'default';
          }
        });
      });

      const chapterHeaderNodes = document.querySelectorAll('.chapter > header'); // 标题节点只关闭当前节点
      chapterHeaderNodes.forEach((node: Element) => {
        node.addEventListener('click', (event) => {
          const thisMapItemNode = node.nextElementSibling; // 当前点击的节点
          const thisChapterNode = node.parentNode as HTMLElement;
          if (thisMapItemNode && thisMapItemNode.classList.contains('map-item-clicked')) { // 若当前点击的节点已展开
            thisMapItemNode.classList.remove('map-item-clicked');
            thisChapterNode.style.cursor = '';
            event.stopPropagation(); // 闭合节点并阻止冒泡
          }
        });
      });
    }

    mapSelector();
  }

  /**
   * 从选择地图界面切换到游戏框架
   * @param loader - 地图加载器
   */
  static mapSelectToLoading(loader: MapLoader): void {
    const currentMapNode = document.querySelectorAll('.map-item figure');
    const mapSelect: HTMLElement = document.querySelector('.map-select') as HTMLElement;
    const loadingBar: HTMLElement = document.querySelector('#loading') as HTMLElement;

    currentMapNode.forEach((node: Element) => {
      node.addEventListener('click', () => {
        mapSelect.style.opacity = '0';
        mapSelect.addEventListener('transitionend', () => {
          mapSelect.classList.add('side-bar'); // 将地图选择左侧边栏化
          mapSelect.style.display = 'none'; // 彻底隐藏左侧边栏

          loadingBar.style.display = 'flex';
          const { dataset } = node as HTMLElement;
          if (dataset.url) { loader.load(dataset.url); }
        }, { once: true });
      });
    });
  }

  /**
   * 更新加载进度条
   * @param itemsLoaded: 已加载资源数
   * @param itemsTotal: 总资源数
   * @param callback: 加载完成回调函数
   */
  static updateLoadingBar(itemsLoaded: number, itemsTotal: number, callback?: Function): void {
    const bar: HTMLElement = document.querySelector('#bar') as HTMLElement;
    const left: HTMLElement = document.querySelector('#left') as HTMLElement;
    const right: HTMLElement = document.querySelector('#right') as HTMLElement;

    left.style.margin = '0';
    left.style.transform = 'translateX(-50%)';
    right.style.margin = '0';
    right.style.transform = 'translateX(50%)';

    const percent: number = (itemsLoaded / itemsTotal) * 100;
    bar.style.width = `${100 - percent}%`; // 设置中部挡块宽度
    left.textContent = `${Math.round(percent)}%`;
    right.textContent = `${Math.round(percent)}%`; // 更新加载百分比

    if (percent >= 100 && callback !== undefined) { // 运行加载完成回调函数
      bar.addEventListener('transitionend', () => {
        right.style.display = 'none';
        this.updateTip('加载完成');
        setTimeout(() => { this.loadingToGameFrame(callback); }, 200);
      });
    }
  }

  /** 隐藏加载进度条并显示画布 */
  static loadingToGameFrame(func: Function): void {
    const loading: HTMLElement = document.querySelector('#loading') as HTMLElement;
    const gameFrame: HTMLElement = document.querySelector('.game-frame') as HTMLElement;
    const mapSelect: HTMLElement = document.querySelector('.map-select') as HTMLElement;

    loading.style.opacity = '0'; // 渐隐加载进度条
    loading.addEventListener('transitionend', () => {
      loading.style.display = 'none';
      gameFrame.style.display = 'block'; // 渐显画布
      func(); // 主回调在画布显示后运行
      mapSelect.style.display = '';

      setTimeout(() => {
        gameFrame.style.opacity = '1';
        mapSelect.style.opacity = ''; // 显示地图选择左侧边栏
      }, 200);
    }, { once: true });
    LoadingUI.collapseMapSelect();
  }

  /** 折叠地图选择侧边栏 */
  private static collapseMapSelect(): void {
    const expandMapItem: HTMLElement | null = document.querySelector('.map-item.map-item-clicked');
    if (expandMapItem) {
      expandMapItem.classList.remove('map-item-clicked');
    }
  }
}


class GameController {
  private readonly startBtn: HTMLElement;

  private readonly resetBtn: HTMLElement;

  private readonly controls: OrbitControls; // 镜头控制器

  private readonly timeAxis: TimeAxis; // 时间轴对象

  private readonly timeAxisUI: TimeAxisUI; // 时间轴UI

  private readonly sRenderer: StaticRenderer; // 静态渲染类

  private readonly staticRender: OmitThisParameter<() => void>; // 静态渲染函数

  private readonly dRenderer: DynamicRenderer; // 动态渲染类

  constructor(controls: OrbitControls,
              timeAxis: TimeAxis, timeAxisUI: TimeAxisUI,
              sRenderer: StaticRenderer, dRenderer: DynamicRenderer) {
    this.startBtn = document.querySelector('#starter') as HTMLElement;
    this.resetBtn = document.querySelector('#reset') as HTMLElement;
    this.resetBtn.addEventListener('click', this.reset);

    this.controls = controls;
    this.timeAxis = timeAxis;
    this.timeAxisUI = timeAxisUI;

    this.sRenderer = sRenderer;
    this.dRenderer = dRenderer;
    this.staticRender = this.sRenderer.requestRender.bind(this.sRenderer);
  }

  /**
   * 开始动态渲染动画后的状态
   */
  start: () => void = () => {
    this.startBtn.textContent = '⏸';
    this.startBtn.removeEventListener('click', this.start);
    this.startBtn.addEventListener('click', this.pause);
    this.controls.removeEventListener('change', this.staticRender);
    window.removeEventListener('resize', this.staticRender);
    this.timeAxis.start();
    this.dRenderer.requestRender();
  };

  /**
   * 暂停动态动画渲染的状态（切换为静态渲染）
   */
  pause: () => void = () => {
    this.stop();
    this.startBtn.addEventListener('click', this.continue);
  };

  /**
   * 继续渲染已暂停动画的状态
   */
  continue: () => void = () => {
    this.startBtn.textContent = '⏸';
    this.startBtn.removeEventListener('click', this.continue);
    this.startBtn.addEventListener('click', this.pause);
    this.controls.removeEventListener('change', this.staticRender);
    window.removeEventListener('resize', this.staticRender);
    this.timeAxis.continue();
    this.dRenderer.requestRender();
  };

  /**
   * 停止动画渲染的状态（需要重置战场）
   */
  stop: () => void = () => {
    this.timeAxis.stop();
    this.dRenderer.stopRender();
    this.startBtn.textContent = '▶';
    this.startBtn.removeEventListener('click', this.pause);
    this.controls.addEventListener('change', this.staticRender);
    window.addEventListener('resize', this.staticRender);
  };

  /**
   * 重置地图和动画后的状态（等待动画开始）
   * TODO: 增加重置时的主文件回调
   */
  reset: () => void = () => {
    this.timeAxis.stop();
    this.dRenderer.stopRender();

    this.startBtn.textContent = '▶';
    this.startBtn.removeEventListener('click', this.pause);
    this.startBtn.removeEventListener('click', this.continue);
    this.startBtn.addEventListener('click', this.start);
    this.controls.addEventListener('change', this.staticRender);
    window.addEventListener('resize', this.staticRender);

    this.timeAxisUI.clearNodes();
    this.timeAxisUI.resetTimer();
    this.sRenderer.requestRender();
  };
}


class TimeAxisUI {
  private readonly timeAxis: HTMLElement;

  private readonly timer: HTMLElement;

  /** 时间轴UI控制 */
  constructor() {
    this.timeAxis = document.querySelector('#axis') as HTMLElement;
    this.timer = document.querySelector('#timer') as HTMLElement; // 计时器
  }

  /**
   * 创建显示在时间轴上的单位节点
   * @param type - 单位节点视觉行为，由单位类型与单位行为组成：
   *  类型：（标记）橙色表示敌方单位(enemy)，蓝色表示己方单位(ally)
   *  行为：（图标）正常色表示创建(create)，灰度表示死亡(dead)，漏怪(drop)以红色标记表示
   * @param name - 单位名称：用于节点类名
   * @param iconUrl - 单位图标资源url
   * @param createTime - 单位创建时间（浮点数）
   * @param nodeTime - 节点时间（字符串）
   * @returns - 返回时间轴节点
   */
  createAxisNode(type: string, name: string, iconUrl: string,
                 createTime: number, nodeTime: string): HTMLDivElement {
    const node = document.createElement('div'); // 创建容器节点
    node.dataset.createTime = createTime.toFixed(4); // 在节点的数据属性中记录出现时间
    node.setAttribute('class', `mark-icon ${name}`);

    node.addEventListener('mouseover', () => {
      const nodes = this.timeAxis.querySelectorAll(`.${name}`);
      nodes.forEach((item: Element) => {
        const icon: HTMLElement | null = item.querySelector('.icon');
        const detail: HTMLElement | null = item.querySelector('.detail');
        const arrow: HTMLElement | null = item.querySelector('.detail-arrow');

        if (icon && detail && arrow) {
          if (window.getComputedStyle(icon).filter === 'none') { // 在原样式基础上增加光标高亮行为
            icon.style.filter = 'brightness(2)';
          } else {
            icon.style.filter = `${window.getComputedStyle(icon).filter} brightness(2)`;
          }
          icon.style.zIndex = '999';

          detail.style.display = 'block';

          arrow.style.display = 'block';
        }
      });
    });

    node.addEventListener('mouseout', () => {
      const nodes = this.timeAxis.querySelectorAll(`.${name}`);
      nodes.forEach((item: Element) => {
        const icon: HTMLElement | null = item.querySelector('.icon');
        const detail: HTMLElement | null = item.querySelector('.detail');
        const arrow: HTMLElement | null = item.querySelector('.detail-arrow');

        if (icon && detail && arrow) {
          icon.style.filter = '';
          icon.style.zIndex = '';

          detail.style.display = 'none';

          arrow.style.display = 'none';
        }
      });
    });

    const markNode = document.createElement('div'); // 创建时间轴标记节点
    markNode.setAttribute('class', `mark ${type}`);

    const iconNode = document.createElement('div'); // 创建图标标记节点
    iconNode.setAttribute('class', 'icon');
    iconNode.style.backgroundImage = `url("${iconUrl}")`;

    const detailNode = document.createElement('div'); // 创建详细时间节点
    detailNode.setAttribute('class', 'detail');
    detailNode.textContent = nodeTime;

    const detailArrow = document.createElement('div'); // 创建小箭头节点
    detailArrow.setAttribute('class', 'detail-arrow');

    node.appendChild(markNode);
    node.appendChild(iconNode);
    node.appendChild(detailNode);
    node.appendChild(detailArrow);
    this.timeAxis.appendChild(node);
    return node;
  }

  /** 清除时间轴上的所有节点 */
  clearNodes(): void {
    while (this.timeAxis.firstChild) { // 清除时间轴的子节点
      this.timeAxis.removeChild(this.timeAxis.firstChild);
    }
  }

  /**
   * 更新子节点在时间轴上的位置
   * @param axisTime - 当前时刻
   */
  updateAxisNodes(axisTime: number): void {
    this.timeAxis.childNodes.forEach((child: Node) => {
      const { style, dataset } = child as HTMLElement;
      const createTime = Number(dataset.createTime);
      const pos = ((createTime / axisTime) * 100).toFixed(2);
      style.left = `${pos}%`;
    });
  }


  /**
   * 设置计时器时间
   * @param time - 新的计时器时间
   */
  setTimer(time: string): void {
    if (this.timer) { this.timer.textContent = time; }
  }

  /** 重置计时器 */
  resetTimer(): void {
    if (this.timer) { this.timer.textContent = '00:00.000'; }
  }
}


export {
  LoadingUI,
  TimeAxisUI,
  GameController,
};
