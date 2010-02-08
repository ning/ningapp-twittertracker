
configFields = ['keywords', 'updatesPerPage'];
settingsElements = ['settingsform'];
appElements = ['main'];
var config = { number:5, keywords:''};
var newUpdatesNum = 0;
var timeoutId = 0;
var page = 1;

configLoaded = function(response){
	var select = document.getElementById('n_updates');
	var curr_view_ref = gadgets.views.getCurrentView();
	if (curr_view_ref.getName() == "home" || curr_view_ref.getName() == "canvas") {

		var prefs = new gadgets.Prefs(); // create an accessor to the prefs
		var n = prefs.getString("n_updates");
		var k = prefs.getString("keywords");

	    if ((k != undefined ) && (k.length > 0 )) { 
	        document.getElementById('keywords').value = k;
	        config.number = n;
	        config.keywords = k;
	        loadList(n, k);
	    } else {
	        if (response.get("owner_data").hadError()) {
		        alert('error loading configuration')
		    } else {
		        var data = response.get("owner_data").getData();
		        if (data[owner.getId()]) {
		            var n = data[owner.getId()].updatesPerPage;
			        var k = data[owner.getId()].keywords;

		            if ((k != undefined ) && (k.length > 0 )) { 
		                document.getElementById('keywords').value = k;
		                config.number = n;
		                config.keywords = k;
		                loadList(n, k);
		            } else {
		                displaySparseMsg();
		            }
		        } else {
					displaySparseMsg();
				}
		    }
	    }

	} else {

		// FLOW FOR PROFILE - PERSISTANT FIRST THEN USERPREFS
	    if (response.get("owner_data").hadError()) {
	        alert('error loading configuration')
	    } else {
	        var data = response.get("owner_data").getData();
	        if (data[owner.getId()]) {
	            var n = data[owner.getId()].updatesPerPage;
		        var k = data[owner.getId()].keywords;

	            if ((k != undefined ) && (k.length > 0 )) { 
	                document.getElementById('keywords').value = k;
	                config.number = n;
	                config.keywords = k;
	                loadList(n, k);
	            } else {
	                displaySparseMsg();
	            }
	        } else {
				var prefs = new gadgets.Prefs(); // create an accessor to the prefs
				var n = prefs.getString("n_updates");
				var k = prefs.getString("keywords");
			}
	    }

	}

	for (var i=0; i < select.options.length; i++) {
        if ((select.options.item(i)) && (select.options.item(i).value == n)) {
            select.options.item(i).setAttribute('selected', 'true');
            break;
        }
    }

    gadgets.window.adjustHeight();
}


updateConfig = function(){
    var select = document.getElementById('n_updates');
    var updatesPerPage = select.options[select.selectedIndex].value;
    var keywords = document.getElementById('keywords').value;
    var req = opensocial.newDataRequest();
    for(var i in configFields) {
        req.add(req.newUpdatePersonAppDataRequest("OWNER", configFields[i], eval(configFields[i])),"set_data");
    }

    req.send(onConfigUpdated);
    return false
}

writeToActivity = function(msg, msgbody){
	// console.log("writeToActivity: msg = " + msg + " || msgbody = " + msgbody);
	var params = {};
	params[opensocial.Activity.Field.TITLE] = msg;
	params[opensocial.Activity.Field.BODY] = msgbody;
	var activity = opensocial.newActivity(params);
	opensocial.requestCreateActivity(activity, opensocial.CreateActivityPriority.HIGH, function(){
		// console.log("callback function of writeToActivity was successful");
	});
};

onConfigUpdated = function(response)  {
    if (response.get("set_data").hadError()) {
      alert('Error updating config');
    } else {
        var select = document.getElementById('n_updates');
        var updatesPerPage = select.options[select.selectedIndex].value;
        var keywords = document.getElementById('keywords').value;
        config.number = updatesPerPage;
        config.keywords = keywords;
        loadList(updatesPerPage, keywords);
		var str = 'This Network is now displaying search results for "' + keywords + '"';
        str.replace(/\"\"/g,"\"")
        writeToActivity(str, "");
        toggleSettings();
    }
};

function html_entity_decode(html) {
  var ta = document.createElement("textarea");
  ta.innerHTML = html.replace(/</g,"&lt;").replace(/>/g,"&gt;");
  return ta.value;
}

loadList = function(numUpdates, keywords, page, since_id){
    clearTimeout(timeoutId);
    if (!numUpdates) numUpdates = config.number;
    if (keywords == undefined) keywords = config.keywords;
    if(!page) page = 1;
    keywords = html_entity_decode(keywords);
    document.getElementById('sparse-msg').style.display = "none";
    document.getElementById('list-title').style.display = "block";
    document.getElementById('statuslist').style.display = "block";
    document.getElementById('title-keywords').innerHTML = keywords;
    document.getElementById('keywords').value = keywords;
    config.keywords = keywords;
    var url = 'http://search.twitter.com/search.json';
    var params = {};
    var postdata = {
        q : keywords,
        page: page,
        rpp : numUpdates
    };
    if(since_id) postdata.since_id = since_id;
    params[gadgets.io.RequestParameters.CONTENT_TYPE] = gadgets.io.ContentType.JSON;
    params[gadgets.io.RequestParameters.HEADERS] = {
        "User-Agent" : "Ning.com Twitter Tracker OpenSocial Gadget"
    };
    params[gadgets.io.RequestParameters.METHOD] = gadgets.io.MethodType.GET;
    gadgets.io.makeRequest(url+'?'+gadgets.io.encodeValues(postdata)+'&t='+ new Date().getTime(), listLoaded, params);
}

function listLoaded(ret) {
    var htmlout = '';
    var list = document.getElementById('statuslist');
    if(ret.errors && ret.errors.length>0){
        htmlout = 'Error - ' + ret.errors[0];
    } else {
        for ( var i=0; i < ret.data.results.length; i++) {
            htmlout += '<li class="status">' + 
            '<a class="avatar" target="_blank" href="http://twitter.com/'+ ret.data.results[i].from_user + '">'+
            '<img src="'+ ret.data.results[i].profile_image_url + '" /></a> '+
            twitter_at_linkify(linkify(ret.data.results[i].text)) + '<span class="timestamp">' + elapsed_time(ret.data.results[i].created_at) + '</span>'
            htmlout += '</li>'
        }
        if (ret.data.results.length == 0){
            htmlout = '<li>No results found.</li>'
        }
        if (ret.data.query == ''){
            displaySparseMsg();
        }
    }
    if (ret.data.since_id == 0) {
        list.innerHTML = htmlout;
        pagination_next = document.getElementById('pagination-next');
        pagination_prev = document.getElementById('pagination-prev');
        pagination_next.style.display = (ret.data.results.length >= ret.data.results_per_page) ? 'inline' : 'none';
        pagination_prev.style.display = (page > 1) ? 'inline' : 'none';
    } else {
        newUpdatesNum += ret.data.results.length;
        if(newUpdatesNum > 0) {
            var refreshBox = document.getElementById('refresh-box')
            refreshBox.innerHTML = newUpdatesNum + ' new results. <a href="#" onclick="return refreshList();">Refresh</a> to see them.';
            refreshBox.style.display = 'block';
        }
    }
    gadgets.window.adjustHeight();
    //check for updates after 1 minute
    timeoutId = setTimeout(function(since_id){
        loadList(config.number, config.keywords, 1, since_id)
    },1000*60*1, ret.data.max_id);
}

displaySparseMsg = function(){
    document.getElementById('sparse-msg').style.display = "block";
    document.getElementById('list-title').style.display = "none";
    document.getElementById('statuslist').style.display = "none";
}

refreshList = function(pageNum){
    newUpdatesNum = 0;
    var refreshBox = document.getElementById('refresh-box')
    refreshBox.style.display = 'none';
    document.getElementById('statuslist').innerHTML = '';
    page = 0;
    if(pageNum) page = pageNum;
    loadList(config.number, config.keywords, page);
    return false;
}

previousPage = function(){
    refreshList(page-1);
    return false;
}

nextPage = function(){
    refreshList(page+1);
    return false;
}

function elapsed_time(date) {
    if(!date) return "";
    d = new Date();
    d.setTime(Date.parse(date));
    var diff = (new Date().getTime()) - d.getTime();
    if (diff <= 0) {
        return (new gadgets.Prefs().getMsg('JUST_NOW'));
    } else if (diff < 60*1000) {
        var seconds = Math.floor(diff/1000);
        return seconds + ((seconds==1) ? ' __MSG_SECOND_AGO__' : ' __MSG_SECONDS_AGO__');
    } else if (diff < 3600*1000) {
        var minutes = Math.floor(diff/1000/60);
        return minutes + ((minutes==1) ? ' __MSG_MINUTE_AGO__' : ' __MSG_MINUTES_AGO__');
    } else if (diff < 86400*1000) {
        var hours = Math.floor(diff/1000/60/60);
        var minutes = Math.floor((diff - 60*60*hours)/60*1000);
        return hours + ((hours==1) ? ' __MSG_HOUR_AGO__' : ' __MSG_HOURS_AGO__');
    } else if (diff < 3600*48) {
        return '__MSG_1_DAY_AGO__';
    } else {
        return (d.getMonth()+1)+'/'+d.getDate()+
        ((d.getFullYear() == new Date().getFullYear()) ? '' : ('/'+d.getFullYear()))+ 
        (' - '+d.getHours()+':'+d.getMinutes());
    }
}


function linkify(s) {
    var re = /(http:\/\/|ftp:\/\/|https:\/\/|www\.|ftp\.[\w]+)([\w\-\.,@?^=%&amp;:\/~\+#]*[\w\-\@?^=%&amp;\/~\+#])/gi;
    var result = s.replace(re, '<a target="_blank" href="$1$2" >$1$2</a>');
    return result;
}

function twitter_at_linkify(s){
    var re = /(@)([\w]+)/gi;
    var result = s.replace(re, '<a target="_blank" href="http://twitter.com/$2" >$1$2</a>');
    return result;
}



//Globals
var viewer
var owner
var env

/* returns the style reference for a given css rule */
function getStyle (cssrule) {
    for (var i in document.styleSheets) {
        var styleRules = (document.styleSheets[i].rules) ? document.styleSheets[i].rules :
                         (document.styleSheets[i].cssRules) ? document.styleSheets[i].cssRules : [];
        for (var j=0; j<styleRules.length; j++){
            if (styleRules[j].selectorText.toUpperCase() == cssrule.toUpperCase()) {
                return styleRules[j];
            }
        }
    }
    return null;
}

function getWebsafeRGB(i) {
	if (i % 51 == 0) {
		return i;
	} else {
		return (i % 51 < 25) ? i-(i%51) : i+(51-(i%51));
	}
}
function convertToHex(str) {
	// This function converse RGB (comma delimited) to HEX. If already HEX, leaves alone.
	str_ar = str.replace(/rgb\(|\)/g, "").split(",");
	str_ar[0] = getWebsafeRGB(parseInt(str_ar[0], 10)).toString(16).toUpperCase();
	str_ar[1] = getWebsafeRGB(parseInt(str_ar[1], 10)).toString(16).toUpperCase();
	str_ar[2] = getWebsafeRGB(parseInt(str_ar[2], 10)).toString(16).toUpperCase();
	str_ar[0] = (str_ar[0].length == 1) ? '0' + str_ar[0] : str_ar[0];
	str_ar[1] = (str_ar[1].length == 1) ? '0' + str_ar[1] : str_ar[1];
	str_ar[2] = (str_ar[2].length == 1) ? '0' + str_ar[2] : str_ar[2];
	var returnVal = str_ar.join("");
	if (str.indexOf("#") >= 0) { returnVal = str; }
	return returnVal; 
}


/* Applies the skin from the Open Social container */
function updateCSS() {
    var bgColor     = gadgets.skins.getProperty(gadgets.skins.Property.BG_COLOR);
    var fontColor   = gadgets.skins.getProperty(gadgets.skins.Property.FONT_COLOR);
    var anchorColor = gadgets.skins.getProperty(gadgets.skins.Property.ANCHOR_COLOR);
	var hexAnchorColor	=	convertToHex(anchorColor);
	var gadgetNingLinks = 	getStyle('.xg_sprite');
	gadgetNingLinks.style.backgroundImage = 'url(http://cssdemo01.ning.com/xn_resources/widgets/index/gfx/icons/xg_sprite-' + hexAnchorColor + '.png)';
    var gadgetStyle = getStyle('.gadget');
    var gadgetLinks = getStyle('.gadget a');
    var gadgetButtons = getStyle('input.button');
    gadgetStyle.style.color = fontColor;
    gadgetStyle.style.backgroundColor = bgColor;
    gadgetLinks.style.color = anchorColor;
    gadgetButtons.style.backgroundColor = anchorColor;
    var buttonContrast = Contrast.test(anchorColor, '#222222');
    if (buttonContrast == true) {
      gadgetButtons.style.color = '#222222';
    } else {
      gadgetButtons.style.color = '#FFFFFF';
    }
}

/*
  Color Contrast | Andrew Waer 
  Origins: http://juicystudio.com/services/colourcontrast.php

  Usage:

  // Contrast test for two colors
  // returns passing score OR false if test fails
  Contrast.test('#ffffff', '#000000');

  // find best match from one or two color sets
  // returns array containing two hex values OR false if no match
  Contrast.match('#ffffff', ['#000000', '#336699']);
  Contrast.match(['#ffffff', '#000000', '#336699']);
  Contrast.match(['#ffffff','#ffffcc'], ['#000000', '#336699']);
*/

var Contrast = function()
{
  // private functions and properties
  var _private =
  {
    min : { 
      'brightness': 125, 
      'difference': 500 
    },
    brightness : function(rgb1, rgb2){
      var b1 = ((rgb1.r * 299) + (rgb1.g * 587) + (rgb1.b * 114)) / 1000;
      var b2 = ((rgb2.r * 299) + (rgb2.g * 587) + (rgb2.b * 114)) / 1000;
      return Math.abs(Math.round(b1-b2));
    },
    difference : function(rgb1, rgb2){
      var diff = (Math.max(rgb1.r, rgb2.r) - Math.min(rgb1.r, rgb2.r)) + 
                 (Math.max(rgb1.g, rgb2.g) - Math.min(rgb1.g, rgb2.g)) + 
                 (Math.max(rgb1.b, rgb2.b) - Math.min(rgb1.b, rgb2.b));
      return Math.abs(Math.round(diff));
    },
    rgb : function(hex){
      hex = hex.replace('#','');
      var rgb = {
        r: parseInt(hex[0] + hex[1], 16),
        g: parseInt(hex[2] + hex[3], 16),
        b: parseInt(hex[4] + hex[5], 16)
      };
      return rgb;
    }
  };
  // public functions and properties
  var _public =
  {
    test : function(hex1, hex2){
      var rgb1 = _private.rgb(hex1);
      var rgb2 = _private.rgb(hex2);
      var brightness = _private.brightness(rgb1, rgb2);
      var difference = _private.difference(rgb1, rgb2);
      return (
        brightness >= _private.min.brightness && difference >= _private.min.difference
          ? ((brightness - _private.min.brightness) + (difference - _private. min.difference))
          : false
      );
    },
    match : function(hex1, hex2){
      var total_score, i, j;

      if (typeof hex1 == 'string') {hex1 = [hex1];}
      if (typeof hex2 == 'string') {hex2 = [hex2];}
      var best_match = { 
        score: 0,
        hex1:  null,
        hex2:  null
      };
      if (hex2 == null){
        for (i=0; i<hex1.length; i++){
          for (j=0; j<hex1.length; j++){
            total_score = _public.test(hex1[i], hex1[j]);
            if (total_score > best_match.score){
              best_match.score = total_score;
              best_match.hex1 = hex1[i];
              best_match.hex2 = hex1[j];
            }
          }
        }
      } 
      else {
        for (i=0; i<hex1.length; i++){
          for (j=0; j<hex2.length; j++){
            total_score = _public.test(hex1[i], hex2[j]);
            if (total_score > best_match.score){
              best_match.score = total_score;
              best_match.hex1 = hex1[i];
              best_match.hex2 = hex2[j];
            }
          }
        }
      }
      return (
        best_match.score > 0
        ? [ best_match.hex1, best_match.hex2 ]
        : false
      );
    }
  };
  return _public;
}();

/**
 * Request information about the gadget owner and viewer
 */
function requestInfo(callback) {
  var req = opensocial.newDataRequest();
  req.add(req.newFetchPersonRequest("OWNER"), "owner");
  req.add(req.newFetchPersonRequest("VIEWER"), "viewer");
  req.send(callback);
}

function loadConfig(fields, callback){
    var req = opensocial.newDataRequest();
    env = opensocial.getEnvironment();
    // req.add(req.newFetchPersonAppDataRequest(opensocial.DataRequest.PersonId.OWNER, fields), "owner_data");
	var owner = opensocial.newIdSpec({ "userId" : "OWNER" });
 	req.add(req.newFetchPersonAppDataRequest(owner, fields), "owner_data");
    req.send(callback);
}

function displayFooter(){
    var whichfooter = (env.getDomain().indexOf('ning.com') == -1 ) ? 'others' : 'ning';
    var footer = document.getElementById(whichfooter + '-footer')
    if (footer) { footer.style.display = 'block' }
}

function toggleSettings(){
    var editlink = document.getElementById('edit-link')
    if(document.getElementById(settingsElements[0]).style.display == 'none') {
        editlink.innerHTML = "Cancel";
        for (var i in settingsElements) {
            document.getElementById(settingsElements[i]).style.display = 'block';
        }
        for (var j in appElements) {
            document.getElementById(appElements[j]).style.display = 'none';
        }
    } else {
        editlink.innerHTML = "Twitter Tracker Options";
        for (var i in settingsElements) {
            document.getElementById(settingsElements[i]).style.display = 'none';
        }
        for (var j in appElements) {
            document.getElementById(appElements[j]).style.display = 'block';
        }
    }
    gadgets.window.adjustHeight()
    return false
}

function init() {
    updateCSS();
    requestInfo(function (data) {
        viewer = data.get("viewer").getData();
        owner  = data.get("owner").getData();
        env = opensocial.getEnvironment();
        if(viewer.isOwner()){
			var curr_view_ref = gadgets.views.getCurrentView();
			// In the ning.main / home view, this functionality is built in via the [Edit] button
			if (curr_view_ref.getName() != "home") {
		    	document.getElementById('admin-bar').style.display = 'block';
			}
            gadgets.window.adjustHeight();
        }
        loadConfig(configFields, configLoaded);
        displayFooter();
    })
    gadgets.window.adjustHeight();
}

gadgets.util.registerOnLoadHandler(init);
