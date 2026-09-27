// Lightweight EN / 中文 i18n for the lottery pages (portal, mode 2).
// Static text: <el data-i18n="key">…</el>; placeholders: data-i18n-ph.
// Language selector: any [data-lang] button. Persisted in localStorage.
(function () {
  'use strict';

  var LANG_KEY = 'lottery_lang';
  var SUPPORTED = ['en', 'zh'];

  var DICT = {
    en: {
      language: 'Language',

      // Portal — login
      secureAccess: 'Secure Access',
      username: 'Username',
      password: 'Password',
      login: 'Log in',
      contactMe: 'Contact Me',

      // Portal — welcome
      welcome: 'Welcome',
      openMode1: 'Enter App',
      openMode2: 'Settings',
      logout: 'Logout',
      saveName: 'Save Name',
      saveLive: 'Save Live',

      // Portal — admin
      controlCenter: 'Control Center',
      adminPanel: 'Admin Panel',
      refresh: 'Refresh',
      close: 'Close',
      totalUsers: 'Total users',
      activeNow: 'Active now',
      waiting: 'Waiting',
      expiringSoon: 'Expiring soon',
      createCustomer: 'Create customer',
      duration: 'Duration',
      customMinutes: 'Custom Minutes',
      saveCustomer: 'Save customer',
      customers: 'Customers',
      liveSessions: 'Live sessions',
      deleteExpired: 'Delete expired',

      // Mode 2
      mode2Title: 'Mode 2 Remote Control',
      mode2Subtitle: 'Customize coin reward per grid, then click spin to randomly choose one winner seat.',
      spinRandom: 'Spin Random Winner',
      clearWinner: 'Clear Winner',
      openEditLayout: 'Open Edit Layout',
      saveLayout: 'Save Layout',
      resetLayout: 'Reset Layout',
      displayStyle: 'Display Style:',
      mode1: 'Mode 1',
      mode2: 'Mode 2',
      totalCoins: 'Total Coins:',
      coinCurrency: 'Coin & Currency:',
      usdPerCoin: 'USD / coin',
      symbol: 'Symbol',
      showCoinMode1: 'Show coin on Mode 1',
      coinSize: 'Coin size',
      connectLive: 'Connect Live',
      stopLive: 'Stop Live',
      applyGridSize: 'Apply Grid Size',
      underRecharge: 'Under Recharge:',
      unitCoin: 'Coin',
      unitCurrency: 'Currency',
      custom: 'Custom',
    },

    zh: {
      language: '语言',

      secureAccess: '安全登录',
      username: '用户名',
      password: '密码',
      login: '登录',
      contactMe: '联系我们',

      welcome: '欢迎',
      openMode1: '进入应用',
      openMode2: '设置',
      logout: '退出登录',
      saveName: '保存名称',
      saveLive: '保存直播',

      controlCenter: '控制中心',
      adminPanel: '管理面板',
      refresh: '刷新',
      close: '关闭',
      totalUsers: '用户总数',
      activeNow: '当前在线',
      waiting: '等待中',
      expiringSoon: '即将到期',
      createCustomer: '创建客户',
      duration: '时长',
      customMinutes: '自定义分钟',
      saveCustomer: '保存客户',
      customers: '客户',
      liveSessions: '直播会话',
      deleteExpired: '删除已过期',

      mode2Title: '模式 2 遥控',
      mode2Subtitle: '为每个格子自定义金币奖励，然后点击抽奖随机选出一个获胜座位。',
      spinRandom: '随机抽取获胜者',
      clearWinner: '清除获胜者',
      openEditLayout: '打开布局编辑',
      saveLayout: '保存布局',
      resetLayout: '重置布局',
      displayStyle: '显示样式：',
      mode1: '模式 1',
      mode2: '模式 2',
      totalCoins: '金币总数：',
      coinCurrency: '金币与货币：',
      usdPerCoin: '美元 / 金币',
      symbol: '符号',
      showCoinMode1: '在模式 1 显示金币',
      coinSize: '金币大小',
      connectLive: '连接直播',
      stopLive: '停止直播',
      applyGridSize: '应用网格大小',
      underRecharge: '充值下方显示：',
      unitCoin: '金币',
      unitCurrency: '货币',
      custom: '自定义',
    },
  };

  function getLang() {
    var l;
    try { l = localStorage.getItem(LANG_KEY); } catch (e) { l = null; }
    return SUPPORTED.indexOf(l) >= 0 ? l : 'en';
  }

  function t(key) {
    var d = DICT[getLang()] || DICT.en;
    if (d[key] != null) return d[key];
    if (DICT.en[key] != null) return DICT.en[key];
    return key;
  }

  function apply(root) {
    root = root || document;
    var els = root.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) els[i].textContent = t(els[i].getAttribute('data-i18n'));
    var ph = root.querySelectorAll('[data-i18n-ph]');
    for (var j = 0; j < ph.length; j++) ph[j].setAttribute('placeholder', t(ph[j].getAttribute('data-i18n-ph')));
    var btns = root.querySelectorAll('[data-lang]');
    var cur = getLang();
    for (var k = 0; k < btns.length; k++) btns[k].classList.toggle('lang-active', btns[k].getAttribute('data-lang') === cur);
  }

  function setLang(l) {
    if (SUPPORTED.indexOf(l) < 0) l = 'en';
    try { localStorage.setItem(LANG_KEY, l); } catch (e) { /* ignore */ }
    apply(document);
    try { window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: l } })); } catch (e) { /* ignore */ }
  }

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-lang]') : null;
    if (btn) setLang(btn.getAttribute('data-lang'));
  });

  if (document.readyState !== 'loading') apply(document);
  else document.addEventListener('DOMContentLoaded', function () { apply(document); });

  window.I18N = { t: t, apply: apply, setLang: setLang, getLang: getLang };
})();
