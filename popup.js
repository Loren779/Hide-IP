var _bg = chrome.extension.getBackgroundPage();
var ProxyManager = _bg.ProxyManager;
var proxyListContainer = $('#proxy-list')//.hide();
var enterCodeContainer = $('#enter-code-div').hide();
var separatorElement = $('#separator').hide();
var statusMessage = $('#status-message').hide();
var loader = $('#loader');
var menuItems = [];
var lastClickTime = 0;
var msgTimerId = null;
var returnBackTimerId = null;
var _tooltipTimerDelayId = null;
var bLocalTest = false;
var isActivated = false;
var isActivatedJustNow = false;
const anim_duration = 100;
const _tooltip_delay = 500;

SyncStorage.getKey(function(k) {
  if (k)
    isActivated = true
});

var btn_more_Pointer = false
var btn_enter_Pointer = false


function preventLeakStateControlledBy(cb) {
  chrome.privacy.network.webRTCIPHandlingPolicy.get({}, function(details) {
    console.log('webRTCIPHandlingPolicy details:', details);
    if (details.levelOfControl == 'controlled_by_this_extension' ||
        details.levelOfControl == 'controllable_by_this_extension') 
    {
      cb(true, details.value);
    } else {
      cb(false, details.value, details.levelOfControl);
    }
  });
}


// tooltips for checkbox
function getTooltipContent(bPolicySwitchingEnabled) {
  return bPolicySwitchingEnabled 
  ?
  'WebRTC mode is controlled by this extension and <strong>will be switched</strong> before using a proxy from the list.' +
  '<hr/><i>To prevent IP address leaking the extension will set the "disable non-proxied UDP" WebRTC mode just before enabling a proxy. This option forces Chrome to send media through the proxy. This will hurt WebRTC performance and increase the load on the proxy, but prevents IP address leaking. ' +
  'After the proxy is disabled, the extension restores default WebRTC mode. </i>' 
  :
  'WebRTC mode is controlled by this extension, but <strong>will NOT be switched</strong> before using a proxy from the list.' +
  '<hr/><i>To provide the best WebRTC experience Chrome will explore all network paths to find the best way to send and receive media. But websites can detect your real IP address.</i>' +
  '<hr/><strong>Set the checkmark to prevent WebRTC IP address leaking.</strong>'
  ;
}


function populateProxyList() { //[populateProxyList]

  console.log('populateProxyList');

  //ChromeStorage.get('some_options').then( function(val) { console.log(val); })

  ChromeStorage.get('some_options').then( function(some_options_val) {

      if (some_options_val === undefined) { // no saved some_options
        var def_opt = {cur_list:'list1', bPreventLeak:true};
        preventLeakStateControlledBy(function(bThisExtsn) {
          ChromeStorage.setObjExt('some_options', def_opt);
        });
        some_options_val = def_opt;
      } else {
        if (some_options_val.bPreventLeak === undefined) { // cur_list exists, but bPreventLeak not
          // init default
          some_options_val.bPreventLeak = true;
          ChromeStorage.setObjExt('some_options', {bPreventLeak:true});
        }
      }
      console.log('populateProxyList, some_options_val =', some_options_val);
      
      if (!bLocalTest) { // from server

        var proxies = ProxyManager.getProxies(); 
        onProxiesReady(proxies, some_options_val);

      } else { // from storage

        console.log('ChromeStorage.get proxies');
    
        ChromeStorage.get('proxies').then(
          function(val) {
            if (val === undefined) { // no saved proxies
              var proxies = ProxyManager.getProxies(); // from server
              console.log('ChromeStorage.setObj(proxies), len:', proxies.length);
              var someproxies = proxies.slice(0, 50);
              var counter = 50;
              someproxies.forEach(function(prxy) {
                if (counter-- % 2 === 0)
                  prxy.list = 'list1';
                else
                  prxy.list = 'list2';
                delete prxy.isActive;
                delete prxy.manager;
                delete prxy.toggle;
              });
              ChromeStorage.setObj({proxies:someproxies}).then(function() {
                onProxiesReady(someproxies, some_options_val);
              });
            } else { // from storage saved proxies
              val.forEach(function (proxy) {
                proxy.isActive = function() { return false };
                proxy.toggle = function() { };
              });
              onProxiesReady(val, some_options_val);
            }
          },
          function(err) {
            console.error(err);
          }
        );
      }// if bLocalTest
      
    },
    function(err) {
      console.error(err);
    }
  ); //ChromeStorage.get

 
  // some_options - list1 or list2, bPreventLeak
  function onProxiesReady(proxies, some_options) {

    console.log('onProxiesReady, some_options:', some_options);
    var curList = some_options.cur_list;

    if (!bLocalTest) {
      proxies.sort(function sortFunction(a, b) {
        if(a.name < b.name)
          return -1;
        if(a.name > b.name)
          return  1;
        return 0;
      });
    }

    //empty current proxy list
    proxyListContainer.empty();
    menuItems = [];

    if (proxies.length) {
      //console.log(recent_proxies);
      var recent_proxies = ProxyManager.getRecentProxies(curList);
      if (recent_proxies.length) {
        recent_proxies.forEach(function(proxy) {
          menuItems.push(new MenuItem(proxy, proxyListContainer, 'prepend'));
        })
        $('<div>').addClass('badger1').text(chrome.i18n.getMessage('badger1')).prependTo(proxyListContainer);
      }
      $('<div>').addClass('badger2').text(chrome.i18n.getMessage('badger2')).appendTo(proxyListContainer);
      var bDisableSecondList = true;
      proxies.forEach(function(proxy) {
        if (proxy.list === curList)
          menuItems.push(new MenuItem(proxy, proxyListContainer));
        if (proxy.list === 'list2')
          bDisableSecondList = false;
      });

      //select list

      var divSelectList = $('<div id="select-locations-list">').addClass('select-list-radio');
      $('<input type="radio" id="radio1" name="select-locations" value="list1" ' + 
        (curList === 'list1' ? 'checked="checked">' : '>') ).appendTo(divSelectList);
      $('<label for="radio1"' + (curList === 'list1' ? ' class="selected-label">' : '>') + 
        'Hide My IP Network</label>').appendTo(divSelectList);
      $('<input type="radio" id="radio2" name="select-locations" value="list2" ' +
        (curList === 'list2' ? 'checked="checked">' : '>') ).appendTo(divSelectList);
      $('<label for="radio2"' + (curList === 'list2' ? ' class="selected-label">' : '>') + 
        'Floating IP Network (Premium)</label>').appendTo(divSelectList);
      divSelectList.appendTo(proxyListContainer);
      // No items in Floating IP List -> disable that radio button
      if (bDisableSecondList) {
        $('#radio2').attr('disabled', 'disabled');
      }
      $('input[type=radio][name=select-locations]').on('change', function() {  //[on radio button change]
        $('input[type=radio][name=select-locations]').attr('disabled', 'disabled');
        var selected_lst = $(this).val();
        if (ProxyManager.activeProxy) {
         if (ProxyManager.activeProxy.list == selected_lst)
          ChromeStorage.setObjExt('some_options', {cur_list:selected_lst});
        } else {
          ChromeStorage.setObjExt('some_options', {cur_list:selected_lst});
        }
        setTimeout(function() { 
          onProxiesReady(proxies, {cur_list: selected_lst, bPreventLeak: some_options.bPreventLeak });
          document.getElementById('proxy-list').scrollTop = 20000;
        }, 200);
      });
      
      //[PreventLeak checkbox]

      var divPreventLeakDiv = $('<div id="checkbox-prevent-leak">').addClass('preventleak');
      $('<input type="checkbox" id="checkbox1" name="preventleak">' ).appendTo(divPreventLeakDiv);
      $('<label for="checkbox1">Prevent WebRTC IP Leak</label>').appendTo(divPreventLeakDiv);
      divPreventLeakDiv.appendTo(proxyListContainer);
      
      $('div#checkbox-prevent-leak').tooltipster({
        theme: 'tooltipster-light',
        content: 'To prevent IP address leak while using a proxy, WebRTC should use the same network path for media as for normal web traffic. If the checkmark is set, it means the correct WebRTC mode is set or will be automatically set before you enable a proxy and if the extension has control over WebRTC mode.' +
                 '<hr />If the checkbox is disabled (grayed out), it means some other extension controls WebRTC mode. '
                 ,
        contentAsHTML: true,
        minWidth: 250,
        maxWidth: 250,
        hideOnClick: true,
        position: 'top-right',
        offsetX: -12,
        animation: 'fall',
        updateAnimation: 'fade',
        speed: 100,
        delay: 100,
        trigger: 'custom'
      });

      var tooltipForLabel = null; //[tooltipForLabel]
      tooltipForLabel = $('div#checkbox-prevent-leak').tooltipster({
        //theme: 'tooltipster-light',
        contentAsHTML: true,
        minWidth: 270,
        maxWidth: 290,
        multiple: true,
        hideOnClick: true,
        animation: 'slide',
        speed: 100,
        updateAnimation: null,
        delay: _tooltip_delay,
        trigger: 'hover'
      })[0];
      
      preventLeakStateControlledBy(function(bThisExtsn, value, reason) {
        if (bThisExtsn) {
          $('input[type=checkbox][name=preventleak]').attr('disabled', false);
          $('input[type=checkbox][name=preventleak]').prop('checked', some_options.bPreventLeak);
          if (some_options.bPreventLeak) {
            tooltipForLabel.option('theme', 'tooltipster-light');
            divPreventLeakDiv.removeClass('red_border');
          } else {
            tooltipForLabel.option('theme', 'tooltipster-error');
            divPreventLeakDiv.addClass('red_border');
          }
        } else { // not controlled
          var bLeakPreventingStillWorks = (value === chrome.privacy.IPHandlingPolicy.DISABLE_NON_PROXIED_UDP);
          $('input[type=checkbox][name=preventleak]').attr('disabled', 'disabled');
          $('input[type=checkbox][name=preventleak]').prop('checked', bLeakPreventingStillWorks);
          if (tooltipForLabel) { 
            var str = 
              'The extension can\'t controll WebRTC mode, reason: <strong>' + reason + 
              '</strong>' +
              '<hr />WebRTC mode: <strong>' + value + '</strong>' +
              ( bLeakPreventingStillWorks ? 
                '<hr />But the current WebRTC mode still prevents the leak.' 
                : 
                '<hr /><strong>There is WebRTC IP Address leak!</strong>' ) +
              '<hr /><i>If you want WebRTC mode auto switched on and off by this extension, disable other extensions which can control WebRTC mode.</i>';
            tooltipForLabel.content(str);
            if (bLeakPreventingStillWorks) {
              tooltipForLabel.option('theme', 'tooltipster-light');
              divPreventLeakDiv.removeClass('red_border');
            } else {
              tooltipForLabel.option('theme', 'tooltipster-error');
              divPreventLeakDiv.addClass('red_border');
            }
          }
        } 
      });

      var bWholeLabelHover = false;
      $('input[type="checkbox"] + label')
        .hover(
          function() {
            bWholeLabelHover = true;
          },
          function() {
            bWholeLabelHover = false;
            $('div#checkbox-prevent-leak').tooltipster('hide');
            if (_tooltipTimerDelayId) {
              clearTimeout(_tooltipTimerDelayId);
              _tooltipTimerDelayId = null;
            }
            if (tooltipForLabel)
              tooltipForLabel.hide();
          }
        );

      var label_width = parseInt(window.getComputedStyle(document.querySelector('input[type=checkbox][name=preventleak] + label').parentNode).width, 10);
      var marker_width = parseInt((window.getComputedStyle(document.querySelector('input[type=checkbox][name=preventleak] + label'), ':after')).width, 10);
      var some_offset = 8;

      $('input[type=checkbox][name=preventleak] + label').on('mousemove', function(event) {

        if (_tooltipTimerDelayId) {
          clearTimeout(_tooltipTimerDelayId);
          _tooltipTimerDelayId = null;
        }

        if ( event.offsetX > (label_width - marker_width - some_offset ) && 
            event.offsetX < (label_width - some_offset) &&
            bWholeLabelHover ) 
        {
          if (tooltipForLabel)
            tooltipForLabel.hide();
          _tooltipTimerDelayId = setTimeout(function() {
            $('div#checkbox-prevent-leak').tooltipster('show');
          }, _tooltip_delay);

        } else if (bWholeLabelHover && event.offsetX < (label_width - marker_width - some_offset)) {
          if ($('input[type=checkbox][name=preventleak]').attr('disabled') !== 'disabled') {
            $('div#checkbox-prevent-leak').tooltipster('hide');
            _tooltipTimerDelayId = setTimeout(function() {
              if (tooltipForLabel) {
                tooltipForLabel.content( getTooltipContent(some_options.bPreventLeak)).show();
              }
            }, _tooltip_delay);
          }
        } else {
          $('div#checkbox-prevent-leak').tooltipster('hide');
        }
      });

      $('input[type=checkbox][name=preventleak]').on('change', function() {  

        if (ProxyManager.activeProxy) {
          console.log('ProxyManager.activeProxy');

          $('input[type=checkbox][name=preventleak]').prop('checked', some_options.bPreventLeak);
          setStatusMessage('Can\'t switch the mode while using a proxy.', true);

        } else {
          var bVal = $(this).is(':checked');
          console.log('setting checkbox to:', bVal);
          preventLeakStateControlledBy(function(bThisExtsn, value) {
            if (bThisExtsn) {
              some_options.bPreventLeak = bVal;
              ChromeStorage.setObjExt('some_options', {bPreventLeak:bVal});
              if (some_options.bPreventLeak) {
                tooltipForLabel.option('theme', 'tooltipster-light');
                $('div.tooltipster-base').removeClass('tooltipster-error').addClass('tooltipster-light');
                divPreventLeakDiv.removeClass('red_border');
              } else {
                tooltipForLabel.option('theme', 'tooltipster-error');
                $('div.tooltipster-base').removeClass('tooltipster-light').addClass('tooltipster-error');
                divPreventLeakDiv.addClass('red_border');
              }
              tooltipForLabel.content( getTooltipContent(some_options.bPreventLeak) ).hide().show();
            }
          });
          setTimeout(function() {
            preventLeakStateControlledBy(function(bThisExtsn, value) {
              if (bThisExtsn) {

              } else {
                $('input[type=checkbox][name=preventleak]').prop('checked', 
                  (value === chrome.privacy.IPHandlingPolicy.DISABLE_NON_PROXIED_UDP)
                );
              }
            });
          }, 300);
        }
      });
      

      //more locations

      var parent_more = $('<div>').addClass('parent_more').appendTo(proxyListContainer)
      .hover(
        function() { // mouse in
          btn_more.hide();
          btn_enter.show();
          btn_enter.transition({
            x: '40px',
            duration: anim_duration,
            easing: 'in'
          });
          btn_buy.show();
          btn_buy.transition({
            x: '-40px',
            duration: anim_duration,
            easing: 'in'
          });
        },
        function() { // mouse out
          btn_enter.transition({
            x: '-40px',
            duration: anim_duration,
            easing: 'in',
            complete: function() {
              btn_enter.hide();
              if (!btn_more.is(":visible") && !parent_more.is(":hover"))
                btn_more.show();
              if (parent_more.is(":hover")) {
                if (!btn_enter.is(":visible"))
                  btn_enter.show();
                if (!btn_buy.is(":visible"))
                  btn_buy.show();
              }
            }
          });
          btn_buy.transition({
            x: '40px',
            duration: anim_duration,
            easing: 'in',
            complete: function() {
              btn_buy.hide();
              if (!btn_more.is(":visible") && !parent_more.is(":hover"))
                btn_more.show();
              if (parent_more.is(":hover")) {
                if (!btn_enter.is(":visible"))
                  btn_enter.show();
                if (!btn_buy.is(":visible"))
                  btn_buy.show();
              }
            }
          });
        }
      )
      .on('mousemove', function (e) {
        if (parent_more.is(":hover")) {
          if (!btn_enter.is(":visible"))
            btn_enter.show();
          if (!btn_buy.is(":visible"))
            btn_buy.show();
        }
      });

      var btn_buy = $('<div>')
      .addClass('btn_buy')
      .html(chrome.i18n.getMessage('btn_buy'))
      .hide()
      .appendTo(parent_more)
      .on('click', function (e) {
        if (Date.now() - lastClickTime > 100 && e.button === 0) {
          lastClickTime = Date.now();
          chrome.tabs.create({ url: 'https://www.hide-my-ip.com/order.shtml?product=905' });
        }
      });

      var btn_enter = $('<div>')
      .addClass('btn_enter')
      .html(chrome.i18n.getMessage('btn_enter'))
      .hide()
      .appendTo(parent_more)
      .on('click', function (e) {

        statusMessage.hide();

        SyncStorage.getKey(function(k) {
          $('#textarea_key')
            .removeClass('key_invalid')
            .removeClass('key_valid');
          if (k)
            $('#textarea_key').val(k);
        });
        proxyListContainer.transition({
          rotateY: '+=90deg',
          duration: anim_duration,
          easing: 'in',
          complete: function() {
            proxyListContainer.hide();
            enterCodeContainer.transition({rotateY: '90deg', duration: 0});
            enterCodeContainer.show();
            enterCodeContainer.transition({rotateY: '-=90deg', duration: anim_duration, easing: 'in'});
            $('#textarea_key').focus();
          }
        })
      });//btn_enter
      
      if (isActivated)
        btn_enter.html(chrome.i18n.getMessage('btn_change'))

      btn_enter_Pointer = btn_enter

      var btn_more = $('<div>').addClass('btn_more').text(chrome.i18n.getMessage('btn_more_locations'))
        .appendTo(parent_more);
      
      if (isActivated)
        btn_more.html(chrome.i18n.getMessage('btn_more'))

      btn_more_Pointer = btn_more

      proxyListContainer.show();
    } else {
      proxyListContainer.hide();
      separatorElement.hide();
    }

    loader.hide();
    if (bLocalTest) {
      document.getElementById('proxy-list').scrollTop = 20000;
    }
  } // onProxiesReady
}//populateProxyList 


function updateMenuItems() {
  menuItems.forEach(function (menuItem) {
    menuItem.update();
  });
}

function setStatusMessage(message, isError, noOops) {
  if (msgTimerId)
    clearTimeout(msgTimerId);
  msgTimerId = setTimeout(function() {
    msgTimerId = null;
    statusMessage.hide();
  }, 5000);

  if (isError) {
    statusMessage.show();
    //separatorElement.show();
    if (noOops)
      statusMessage.html(message);
    else
      statusMessage.html('<strong>'+chrome.i18n.getMessage('oops_msg')+'</strong> '+message);
    statusMessage.addClass('error');
  }
  else {
    statusMessage.show();
    separatorElement.hide();
    statusMessage.html('<strong>'+chrome.i18n.getMessage('success_msg')+'</strong><br/>'+message);
    statusMessage.removeClass('error');
  }
}


// method: undefined | 'prepend'
function MenuItem(proxy, parent, method) {

  var container = createMenuItemDOMEl(proxy);

  container.on('click', function (e) {                         //[on menu item click]
    if (Date.now() - lastClickTime > 100 && e.button === 0) {
      lastClickTime = Date.now();
      if (proxy.host.length === 0) {
        setStatusMessage(chrome.i18n.getMessage('please_upgrade_msg'), true, true);
        return;
      } 
      statusMessage.hide();
      container.find('.menu-item-subitem').find('span.menu-item-text').hide();
      container.find('.menu-item-subitem').find('span.menu-flag').hide();
      container.find('.menu-item-subitem').find('i.toggle-button-active').hide();
      container.find('.menu-item-subitem').find('span.menu-item-loader').show();
      $.blockUI.defaults.overlayCSS.opacity = 0.3;
      $.blockUI({message: null});
      
      proxy.toggle(function(obj) {
        $.unblockUI();
        container.find('.menu-item-subitem').find('span.menu-item-text').show();
        container.find('.menu-item-subitem').find('span.menu-flag').show();
        container.find('.menu-item-subitem').find('i.toggle-button-active').show();
        container.find('.menu-item-subitem').find('span.menu-item-loader').hide();
        if (obj.status == 'error') {
          setStatusMessage(chrome.i18n.getMessage('please_select_another_msg'), true);
        } else if (obj.status == 'success') {
          setStatusMessage('', false);
        } else if (obj.status == 'success disconnect') {
        }
        updateMenuItems();
      });
    }
  });
  lastClickTime = Date.now();

  //set active state
  proxy.isActive() && container.addClass('active');

  if (proxy.host.length !== 0) {
    container.addClass('free-proxy');
  } 

  //method to update active state
  this.update = function () {
    //console.log('update');
    if (proxy.isActive()) {
      container.addClass('active');
      container.find('.toggle-button-active').show();
      container.find('.toggle-button').hide();
      container.find('.toggle-button-empty').hide();
    }
    else {
      container.removeClass('active');
      container.find('.toggle-button-active').hide();
      container.find('.toggle-button').hide();
      container.find('.toggle-button-empty').show();
    }
  };

  //add to parent container
  if (method === 'prepend')
    container.prependTo(parent);
  else
    container.appendTo(parent);
}


//Creates a proxy menu item
function createMenuItemDOMEl(proxy) {
  var flag, name, item_loader,
      toggleButton, toggleButtonEmpty, toggleButtonActive, toggleButtonTurnOff,
      flagUrl, container;

  flagUrl = 'img/flags/' +
    (proxy.country === '??' || proxy.country === '' ? 'unknown' : proxy.country) +
    '.png';

  container = $('<div>').addClass('menu-item').attr('title', proxy.gateway);
  flag = $('<span>').addClass('menu-flag');//.css('backgroundImage', 'url(' + flagUrl + ')');
  _bg.flagExists(proxy.country, function(bExists) {
    if (!bExists) {
      console.log('flag doesnt exists:', proxy.country);
      flag.css('backgroundImage', 'url(img/flags/unknown.png)');
    } else {
      flag.css('backgroundImage', 'url(' + flagUrl + ')');
    }
  });
  name = $('<span>').addClass('menu-item-text').text(proxy.name);

  toggleButtonActive = $('<i>').addClass('toggle-button-active fa fa-arrow-right');
  toggleButton = $('<i>').addClass('toggle-button fa fa-arrow-right');
  toggleButtonEmpty = $('<i>').addClass('toggle-button-empty fa fa-arrow-right');
  toggleButtonTurnOff = $('<i>').addClass('toggle-button-turn-off fa fa-times');

  if (proxy.isActive()) {
    toggleButton.hide();
    toggleButtonEmpty.hide();
    toggleButtonTurnOff.hide();
  } else {
    toggleButtonActive.hide();
    toggleButton.hide();
    toggleButtonTurnOff.hide();
  }

  item_loader = $('<span>').addClass('menu-item-loader');
  item_loader.hide();

  var subitem = $('<span>').addClass('menu-item-subitem');
  subitem.append(toggleButton)
         .append(toggleButtonEmpty)
         .append(toggleButtonActive)
         .append(toggleButtonTurnOff)
         .append(flag)
         .append(name)
         .append(item_loader);

  container.append(subitem);
  container.hover(
    function(){
      if ($(this).hasClass('active')) {
        $(this).find('.toggle-button-turn-off').show();
        $(this).find('.toggle-button-active').hide();
        $(this).find('.toggle-button').hide();
        $(this).find('.toggle-button-empty').hide();
      } else {
        $(this).find('.toggle-button-active').hide();
        $(this).find('.toggle-button').show();
        $(this).find('.toggle-button-empty').hide();
      }
    },
    //function(){ }
    function(){
      if ($(this).hasClass('active')) {
        $(this).find('.toggle-button-active').show();
        $(this).find('.toggle-button').hide();
        $(this).find('.toggle-button-empty').hide();
        $(this).find('.toggle-button-turn-off').hide();
      } else {
        $(this).find('.toggle-button-active').hide();
        $(this).find('.toggle-button').hide();
        $(this).find('.toggle-button-empty').show();
        $(this).find('.toggle-button-turn-off').hide();
      }
    }
  );
  return container;
}


//listen for messages to repopulate proxy list when results arrive
chrome.runtime.onMessage.addListener(function (r, s, sr) {
  switch (r.msg) {
  case 'populate_proxies':
    populateProxyList();
    break;
  case 'update_proxies':
    updateMenuItems();
    break;
  default:
    if (r.msg.indexOf('error:') >= 0) {
      var msg = r.msg.match(/error:(.+)/)[1];
      if (msg.length === 0)
        msg = 'Error';
      setStatusMessage(msg, true);
      ProxyManager.clearProxy();
    }
  }
});


function checkKey(key, cb) {
  var url = 'https://api.hide-my-ip.com/chrome.cgi?action=keycheck&key=' + key;
  console.log('checkKey, key=', key);
  $.ajax({
    method: 'GET',
    url: url,
    success: function (data) {
      console.log(data)
      if (data.indexOf(': 1') != -1) {
    cb(true);
      } else if (data.indexOf(': 0') != -1) {
        cb(false);
      } else {
        console.error('ERR: unexpected response in checkKey: data =', data);
        cb(false);
      }
    },
    error: function(jqXHR, textStatus, errorThrown) { console.error(textStatus); cb(false); }
  });
}


function Reload() {
  ProxyManager.clearProxy();
  proxyListContainer.empty();
  proxyListContainer.hide();
  loader.show();
  if (bLocalTest) {
    ChromeStorage.get('proxies').then(
      function(val) {
        if (val === undefined) { // no saved proxies
          console.log('no saved proxies')
          ProxyManager.requestProxies();
        }
      });
  } else {
    ProxyManager.requestProxies();
  }
}

$(document).ready(function() {

  console.log('popup, ProxyManager.activeProxy=', ProxyManager.activeProxy)
  
  //[enter code page]

  $('#textarea_key').attr('placeholder', chrome.i18n.getMessage('textarea_placeholder'));

  function returnBack() {

      if (returnBackTimerId) {
        clearTimeout(returnBackTimerId);
        returnBackTimerId = null;
      }
    //return to default page
    enterCodeContainer.transition({
      rotateY: '+=90deg',
      duration: anim_duration,
      easing: 'in',
      complete: function() {
        statusMessage.hide();
         $("#btn_enterCode").removeClass('disabled');
        enterCodeContainer.hide();
        proxyListContainer.show();
        proxyListContainer.transition({
          rotateY: '-=90deg', 
          duration: anim_duration, 
          easing: 'in',
          complete: function() {
            if (isActivatedJustNow) {
              isActivatedJustNow = false;
              setTimeout(Reload, 10);
            }
          }
        });
      }
    });
  }

  $('#btn_back')
  .on('click', function (e) {
    if (!$(this).hasClass('disabled')) {
      returnBack()
    }
  })
  .find('span').text(chrome.i18n.getMessage('btn_back'));//btn_back

  $('#btn_enterCode')
  .on('click', function (e) {
    if (!$(this).hasClass('disabled')) {
      $("#btn_enterCode").addClass('disabled');
      $("#btn_back").addClass('disabled');
      $('#textarea_key').attr('readonly','readonly').addClass('readonly_enabled');
      $("#btn_enterCode i").transition({rotate: '+=360deg', duration: 1000, easing: 'linear'});
      var intervalID = setInterval(function() {
        $("#btn_enterCode i").transition({rotate: '+=360deg', duration: 1000, easing: 'linear'});
      }, 1010);
      
      checkKey($('#textarea_key').val(), function(bResult) {
        $("#btn_enterCode").removeClass('disabled');
        $("#btn_back").removeClass('disabled');
        $('#textarea_key').removeAttr('readonly').removeClass('readonly_enabled');
        clearInterval(intervalID);
        if (bResult) {
          $("#btn_enterCode").addClass('disabled');
          $('#textarea_key').addClass('key_valid').removeClass('key_invalid');
          SyncStorage.saveKey($('#textarea_key').val());
          setStatusMessage(chrome.i18n.getMessage('success_key_msg'), false);
          isActivatedJustNow = isActivated = true;
          btn_more_Pointer.html(chrome.i18n.getMessage('btn_more'))
          btn_enter_Pointer.html(chrome.i18n.getMessage('btn_change'))
          if (returnBackTimerId) {
            clearTimeout(returnBackTimerId);
            returnBackTimerId = null;
          }
          returnBackTimerId = setTimeout(function() {
            returnBack();
            ProxyManager.requestProxies();
          }, 3000);
        } else {
          $('#textarea_key').addClass('key_invalid').removeClass('key_valid');
          setStatusMessage(chrome.i18n.getMessage('invalid_key_msg'), true);
        }
      });
    }
  })
  .find('span').text(chrome.i18n.getMessage('btn_enter_license_key'));

  if (isActivated){
    $('#btn_enterCode').find('span').text(chrome.i18n.getMessage('btn_change_license_key'))
  }

  if (bLocalTest) {
    ChromeStorage.get('proxies')
    .then(
      function(val) {
        if (val === undefined) {
          console.log('no saved proxies')
        } else {
          populateProxyList();
          updateMenuItems();
          return;
        }
      }
    )
  }

  if (ProxyManager.activeProxy) {
    populateProxyList();
    updateMenuItems();
  } else {
    Reload();
  }

});
