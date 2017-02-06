var Storage = {

  saveProxy: function (proxy) {
    if (proxy) {
      localStorage.setItem('proxy', JSON.stringify({
        host: proxy.host,
        port: proxy.port,
        country: proxy.country,
        pass: proxy.pass,
        name: proxy.name,
        list: proxy.list
      }));
    }
    else {
      localStorage.removeItem('proxy');
    }
  },

  getProxy: function (proxy) {
    var storedProxy = localStorage.getItem('proxy');
    return storedProxy && JSON.parse(storedProxy);
  },

  saveRecentLocList: function (obj) {
    if (!obj || !obj.list1 || !obj.list2) {
      console.error('saveRecentLocList: Invalid argument:', obj);
      return;
    }
    function saveList(obj, listname) {
      var tmp = [];
      obj[listname].forEach(function(pr, index) {
        tmp.push({
          host: pr.host,
          port: pr.port,
          country: pr.country,
          pass: pr.pass,
          name: pr.name,
          list: pr.list
        });
      });
      localStorage.removeItem('recent_' + listname);
      if (tmp.length > 0) {
        localStorage.setItem('recent_' + listname, JSON.stringify(tmp));
      }
    }
    saveList(obj, 'list1');
    saveList(obj, 'list2');
  },

  loadRecentLocList: function (listname) {
    if (listname != 'list1' && listname != 'list2') {
      console.error('loadRecentLocList: Invalid parameter:', listname);
      return null;
    }
    return JSON.parse(localStorage.getItem('recent_' + listname));
  },

  saveKey: function (key) {
    ChromeStorage.setObj({key:key});
  },

  getKey: function () {
    ChromeStorage.get('key').then(
      function(val) {
        console.log('ChromeStorage: key =', val);
        if (val === undefined) {
          return null;
        } else {
          return val;
        }
      },
      function(err) {
        console.error(err);
        return null;
      }
    );
  }

}
