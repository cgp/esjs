define([
	"jquery",	
  "jsonpath"
], function ($, JSONPath) {
  
	var ES = {};
  ES.Client = function(cfg) {
    if (typeof cfg === "undefined") cfg = {};
    this.host = (typeof cfg.host === "undefined") ? "127.0.0.1" : cfg.host;
    this.port = (typeof cfg.port === "undefined") ? "9200" : cfg.port;    
    this.context = (typeof cfg.context === "undefined") ? "/" : cfg.context;    
    this.baseurl = "http://"+this.host+":"+this.port+this.context;
    this.cache = {};
    this.ajax = function(url, data, cacheName, opts) {
      var ajaxOpts = {
        url: url,
        crossDomain: true        
      };
      if ((typeof data !== "undefined") && (data != null)) {
        ajaxOpts.data = data;
      }
      $.extend(ajaxOpts, opts);
      var client = this;
      if ((typeof cacheName !== "undefined") && (cacheName != null)) {
        return $.ajax(ajaxOpts).done(function(response) {
          client.cache[cacheName] = response;
        });
      } else {
        return $.ajax(ajaxOpts);
      }      
    }
  }
  
  $.extend(ES.Client.prototype, {
    "version": function(opts) {
      return this.ajax(this.baseurl, null, "version", opts);      
    },
    "stats": function(opts) {
      return this.ajax(this.baseurl+"_nodes/stats?all=true", null, "stats", opts);   
    },
    "nodes": function(opts) {
      return this.ajax(this.baseurl+"_nodes", null, "nodes", opts);   
    },
    "status": function(opts) {
      return this.ajax(this.baseurl+"_status", null, "status", opts);   
    },
    "cluster": function(opts) {      
      return this.ajax(this.baseurl+"_cluster/state", null, "cluster", opts);
    }
  });
  
	window.ES = ES;	 
	return ES;
});