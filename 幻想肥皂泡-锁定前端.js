// 幻想肥皂泡 · 锁定前端
// 安装位置:酒馆助手 → 脚本池(全局脚本)
// 作用:界面进入全屏(伪同层)时锁定所在楼层——隐藏其他楼层,并拦截酒馆
//       对该楼层 iframe 的移除操作(滚动/生成/swipe 触发的重渲染),退出全屏时还原。
$(() => {
  const STYLE_ID = 'hlm-lock-style';
  const PROTECT_ID = 'hlm-lock-protect';
  const parentDoc = window.parent.document;
  const parentWin = window.parent;
  let lockedId = null;

  // 隐藏/显示其他楼层
  function setHide(exceptId) {
    const old = parentDoc.getElementById(STYLE_ID);
    if (old) old.remove();
    if (exceptId === null) return;
    const style = parentDoc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `.mes:not([mesid="${exceptId}"]) { display: none !important; }`;
    parentDoc.head.appendChild(style);
  }

  // 解除父页面保护
  function unprotect() {
    if (parentWin.__hlmLockCleanup) {
      try { parentWin.__hlmLockCleanup(); } catch (e) { console.warn('[幻想肥皂泡·锁定] 清理出错', e); }
    }
    const old = parentDoc.getElementById(PROTECT_ID);
    if (old) old.remove();
  }

  // 激活父页面保护:拦截三种删除路径,保住锁定楼层的 iframe
  function protect(floorId) {
    unprotect();
    const script = parentDoc.createElement('script');
    script.id = PROTECT_ID;
    script.textContent = `
      (function() {
        if (window.__hlmLockCleanup) window.__hlmLockCleanup();
        var FLOOR = ${floorId};
        var _iframeRemove = HTMLIFrameElement.prototype.remove;
        HTMLIFrameElement.prototype.remove = function() {
          var mes = this.closest('[mesid]');
          if (mes && parseInt(mes.getAttribute('mesid'), 10) === FLOOR) return;
          return _iframeRemove.call(this);
        };
        var _removeChild = Node.prototype.removeChild;
        Node.prototype.removeChild = function(child) {
          if (child instanceof HTMLIFrameElement) {
            var mes = child.closest('[mesid]');
            if (mes && parseInt(mes.getAttribute('mesid'), 10) === FLOOR) return child;
          }
          if (child && child.querySelectorAll) {
            var hit = child.querySelectorAll('.mes[mesid="' + FLOOR + '"] iframe');
            if (hit.length > 0) return child;
          }
          return _removeChild.call(this, child);
        };
        if (window.$ && window.$.fn) {
          var _jqRemove = window.$.fn.remove;
          window.$.fn.remove = function() {
            for (var i = 0; i < this.length; i++) {
              var el = this[i];
              if (el instanceof HTMLIFrameElement) {
                var mes = el.closest('[mesid]');
                if (mes && parseInt(mes.getAttribute('mesid'), 10) === FLOOR) {
                  this.splice(i, 1); i--;
                }
              }
            }
            return this.length > 0 ? _jqRemove.call(this) : this;
          };
        }
        window.__hlmLockCleanup = function() {
          HTMLIFrameElement.prototype.remove = _iframeRemove;
          Node.prototype.removeChild = _removeChild;
          if (window.$ && window.$.fn && _jqRemove) window.$.fn.remove = _jqRemove;
          delete window.__hlmLockCleanup;
        };
      })();
    `;
    parentDoc.head.appendChild(script);
  }

  // 取元素所在楼层的 mesid
  function floorOf(el) {
    const mes = el.closest('[mesid]');
    if (!mes) return null;
    const id = parseInt(mes.getAttribute('mesid'), 10);
    return isNaN(id) ? null : id;
  }

  function lock(floorId) {
    if (lockedId === floorId) return;
    if (lockedId !== null) unlock();
    lockedId = floorId;
    setHide(floorId);
    protect(floorId);
    console.info('[幻想肥皂泡·锁定] 楼层 #' + floorId + ' 已锁定');
  }

  function unlock() {
    if (lockedId === null) return;
    const prev = lockedId;
    unprotect();
    setHide(null);
    lockedId = null;
    console.info('[幻想肥皂泡·锁定] 楼层 #' + prev + ' 已解锁');
  }

  // 全屏切换驱动:进全屏锁楼层,退全屏解锁
  $(parentDoc).on('fullscreenchange', () => {
    const fs = parentDoc.fullscreenElement;
    if (!fs) return unlock();
    const id = floorOf(fs);
    if (id !== null) lock(id);
  });
  if (parentDoc.fullscreenElement) {
    const id = floorOf(parentDoc.fullscreenElement);
    if (id !== null) lock(id);
  }

  // 兜底:锁定期间新插入的楼层也藏起来
  const observer = new MutationObserver(entries => {
    if (lockedId === null) return;
    for (const e of entries) {
      for (const node of Array.from(e.addedNodes)) {
        if (node instanceof HTMLElement && node.matches(`.mes:not([mesid="${lockedId}"])`)) {
          node.style.display = 'none';
        }
      }
    }
  });
  observer.observe(parentDoc.getElementById('chat') || parentDoc.body, { childList: true, subtree: true });

  $(window).on('pagehide', () => { unlock(); observer.disconnect(); });
  console.info('[幻想肥皂泡·锁定] 脚本已启动');
});
