define([
	"jquery",	
  "jsonpath"
], function ($, JSONPath) {
  var Util = {};
  
  Util.isNullOrUndefined = function(val) {
    return (typeof val == "undefined") || (val == null);
  }
  
	var ES = {};
  /**
  Provides the base Widget class...
 
  @module widget
  */
  ES.Client = function(cfg) {
    if (typeof cfg === "undefined") cfg = {};
    this.host = Util.isNullOrUndefined(cfg.host) ? "127.0.0.1" : cfg.host;
    this.port = Util.isNullOrUndefined(cfg.port) ? "9200" : cfg.port;    
    this.context = Util.isNullOrUndefined(cfg.context) ? "/" : cfg.context;    
    this.baseurl = "http://"+this.host+":"+this.port+this.context;
    this.cache = {};
    this.ajax = function(url, data, cacheName, opts) {
      var ajaxOpts = {
        url: url,
        crossDomain: true        
      };
      if (!Util.isNullOrUndefined(data)) {
        if (typeof data == "object") {
          data = JSON.stringify(data);
        }
        ajaxOpts.data = data;
      }
      $.extend(ajaxOpts, opts);
      var client = this;
      if (Util.isNullOrUndefined(cacheName)) {
        return $.ajax(ajaxOpts).done(function(response) {
          client.cache[cacheName] = response;
        });
      } else {
        return $.ajax(ajaxOpts);
      }      
    }
  }
  
  
  
  /**
    
    Some sort of description.
    @class ES.Client
    
   */
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
    },
    /**
     Creates an index with basic options or a mapping. 
     
     http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/indices-create-index.html
          
     @method indexCreate      
     @param {String} indexName Name of the index
     @param {integer} shardCount number of shards, defaults to 1 if undefined, if null, defaults to whatever server is configured to
     @param {integer} replicaCount number of replicas, defaults to 0 if undefined, if null, defaults to whatever server is configured to. 
     @param {Object} opts extra options, formatted as specified in the elasticsearch documentation
     @return {String} response The response from the server.
    */
    "indexCreate": function(indexName, shardCount, replicaCount, opts) {
      var ajaxOpts = {
        type: "PUT"
      };      
      if ((typeof opts == "undefined") || (typeof opts != "object")) {
        opts = {};
      }
      if (typeof shardCount == "undefined") {shardCount = 1};
      if (typeof replicaCount == "undefined") {replicaCount = 0};
      if (typeof opts.settings == "undefined") {
        opts.settings = {};
      }
      opts.settings.number_of_shards = shardCount;
      opts.settings.number_of_replicas = replicaCount;      
      return this.ajax(this.baseurl+indexName+"/", opts, null, ajaxOpts);
    },
    
    /**
      Tests whether an index exists.
      
      See, it would be tempting to use async here if I didn't understand the promise of promises:
      https://gist.github.com/domenic/3889970
            
      Great article, now I need to rewrite the docs to reflect this better.
      
      http://eng.wealthfront.com/2012/12/jquerydeferred-is-most-important-client.html
      http://www.html5rocks.com/en/tutorials/es6/promises/
      
      http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/indices-exists.html
      
     @method indexCreate      
     @param {String} indexName Name of the index
     @return {boolean} response Interpreted response from server. 
    */
    "indexExists": function(indexName) {
      var ajaxOpts = {
        type: "HEAD"        
      };      
      return this.ajax(this.baseurl+indexName+"/", null, null, ajaxOpts).then(function(response, text, xhr) {        
        return new jQuery.Deferred().resolve(true);
      }, function() {
        return new jQuery.Deferred().resolve(false);
      });
    },
    /**
      Deletes an index.
      
      http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/indices-delete-index.html
      
      @method indexDelete
      @param {String} indexName
      @return {boolean} response The response from the server. (true if successful)
    */
    "indexDelete": function(indexName) {
      var ajaxOpts = {
        type: "DELETE"        
      };      
      return this.ajax(this.baseurl+indexName+"/", null, null, ajaxOpts).then(function(response, text, xhr) {        
        return new jQuery.Deferred().resolve(true);
      }, function() {        
        return new jQuery.Deferred().resolve(false);
      });
    },    
    
    /**
      Creates a set of records.
      
      http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/docs-bulk.html
      
      A basic call would look like:
      
      es.docBulk([{name: "Carson, John"},{name: "McMahon, Ed"},{name: "Correct, Sir"}], {_index: "names", _type: "name"});
      
      Would load the data. Alternatively, if you want more fine grain control, specify the first argument as
      a string and the data will be posted directly to the server.      
     
      @method docBulk
      @param {String|Array} records records in the format expected by an elasticsearch server, or a set of objects that will be serialized into an array
      @param {Object} opts Additional information to post to the server such as the index. Will be utilized if you specify a set of JSON objects in an array.
      @return {String} response The response from the server.
     */

    "docBulk": function(records, opts) {
      var ajaxOpts = {
        type: "POST",
        contentType:"application/json; charset=utf-8"
      };      
      var t = "";      
      if(Array.isArray(records)) {       
        for(var x=0;x<records.length;x++) {
          t += '{ "index" : {_index:"'+opts._index+'",_type:"'+opts._type+"\"}}\n";
          t += JSON.stringify(records[x])+"\n";
        }
      }
      return this.ajax(this.baseurl+opts._index+"/_bulk", t, null, ajaxOpts);
    },
    
    "createSearch": function(name, indicies, type) {
      return new ES.Search(name, indicies, type, this, cfg);
    },
  });

  // http://okfnlabs.org/blog/2013/07/01/elasticsearch-query-tutorial.html#match-all--find-everything
  // http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-request-body.html  
  // http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search.html
  ES.Search = function(indicies, client) {
    if (Util.isNullOrUndefined(indices)) {
      name = "_all";
    } else if (Array.isArray(indicies)) {
      indicies = indicies.join(",");
    }    
    this.indicies = indicies;    
    this.client = client;
    this.post_filter = new ES.Filter(this);
    this.sorts = [];
    this.aggs = []; // we're going to implement facets this way of course    
    this.query = new ES.Query(this)
  }

  $.extend(ES.Search.prototype, {
    "from": function(from) {
      this.from = from;
    },
    "size": function(size) {
      this.size = size;
    },
    "addSortBy": function(field, order, mode, missing) {
      var sortObj = {"field": field};      
      this.sorts.push({"field": field, "order": order, "mode": mode, "missing": missing});
    },
    "removeSortBy": function(field, order, mode, missing) {
    }    
  });
  
  // http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-queries.html
  ES.Query = function(parent) {    
    this.parent;
    this.queries = [];
    this.filter = new Filter(this);
  }  
  
  $.extend(ES.Query.prototype, {    
    "matchAll": function() {
    },
    "getQuery": function() {      
      var rootObj = {};      
      return "hallo";
    }
  });
  
  // http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-filters.html
  ES.Filter = function(parent) {
    this.parent = parent;
    this.filters = [];
  }
  
  $.extend(ES.Filter.prototype, {
    "term": function(term, values, opts) {
      this.filters.push({});
    }    
  }
  
	window.ES = ES;	 
	return ES;
});