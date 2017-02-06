var ProxyAdapter = {
  // type 1: https connect, type 2: socks5
  setProxy: function (host, port, type) {
    var config = {
      mode: 'fixed_servers',
      rules: {
        singleProxy: {
          host: host,
          port: port
        },
        bypassList: ['https://api.hide-my-ip.com']
      }
    };
    
    if (type && type === 2) {
      config = {
        mode: 'fixed_servers',
        rules: {
          singleProxy: {
            scheme: 'socks5',
            host: host,
            port: port
          },
          bypassList: ['https://api.hide-my-ip.com']
        }
      };
    }
    this._setProxySettings(config);
  },

  removeProxy: function() {
    var config = {
      mode: 'direct'
    };
    this._setProxySettings(config);
  },

  _setProxySettings: function(config) {
    chrome.proxy.settings.set({
        value: config,
        scope: 'regular'
      },
      function () {});
 }
}