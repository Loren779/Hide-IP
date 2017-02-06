
(function () {

  this.DataService = {

    requestListProxy: function(successCb, errorCb) {
      console.log('DataService.requestListProxy, uniqueid =', uniqueid);
      var url = 'https://api.hide-my-ip.com/chrome.cgi?uniqueid=' + uniqueid;
      SyncStorage.getKey(function(k) {
        if (k)
          url += '&key=' + k;
        $.ajax({
          method: 'GET',
          url: url,
          success: function (data) {
            successCb(data.split('\n'))
          },
          error: function(jqXHR, textStatus, errorThrown) { errorCb(textStatus); }
        });
      });
    },

    registerIP: function (ip, successCb, errorCb) {
      var url = 'https://api.hide-my-ip.com/chrome.cgi?ip=' + ip + '&uniqueid=' + uniqueid;
      console.log('DataService registerIP, url=', url);
      SyncStorage.getKey(function(k) {
        if (k)
          url += '&key=' + k;
        $.ajax({
          method: 'GET',
          url: url,
          success: function (data) {

            console.log('response len:', data.length)
            console.log(data)

            if (data.length == 32)
              successCb(1, data);//type, data
            else if (data.length == 3 && data.substr(0, 2) === '-1')
              successCb(2);
            else
              errorCb('registerIP:', data);
          },
          error: function (jqXHR, textStatus, errorThrown) {
            errorCb(textStatus);
          }
        });

      });
    }
  }

}).call(this);