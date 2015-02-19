define([
	"jquery",
  "jsonpath"
], function ($, JSONPath) {
  var Utils = {
   "isUndefinedOrNull": function(val) {
                          return (typeof val == "undefined") || (val == null);
   },  
   "array_move": function(arr,old_index, new_index) {
                    if (new_index >= arr.length) {
                        var k = new_index - arr.length;
                        while ((k--) + 1) {
                            arr.push(undefined);
                        }
                    }
                    arr.splice(new_index, 0, arr.splice(old_index, 1)[0]);
                    return arr; // for testing purposes  
   },
   "array_remove": function(arr, from, to) {
                    var rest = arr.slice((to || from) + 1 || arr.length);
                    arr.length = from < 0 ? arr.length + from : from;
                    return arr.push.apply(this, rest);
   },
   "serialize": function(o) {                  
                  var queryString = "",
                      delim = "",
                      props = Object.keys(o);
                      
                  for(var x=0;x<props.length;x++) {
                    queryString += delim + props[x] + "=" + encodeURIComponent( o[props[x]] );      
                    delim = "&";
                  }
                  return queryString;
   },
   "getQueryDSLStruct": function(queryDSLStruct) {      
      // ends up getting used by Search,Query,Filter, so Utils is the most logical location
      var keys = Object.keys(queryDSLStruct);
      if (keys.length == 0) {
        return null;
      }
      var body = {};
      for(var x=0;x<keys.length;x++) {
        if (typeof queryDSLStruct[keys[x]] == "function") {
          body[keys[x]] = queryDSLStruct[keys[x]]();
        } else {
          body[keys[x]] = queryDSLStruct[keys[x]].getBody(); // a little presumptious, we'll get back to this
        }
      }
      return body;
    }
  };
  
  
  
  // From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys -- removed unless I hear complaints

	var ES = {};
  
  ES.Node = function(parent, getBodyFunc) {
    this.parent = parent;    
    this.getBody = getBodyFunc;
  }  
  
  var baseStuff = {
    "up": function() {
      return this.parent;
    }
  };
  
  $.extend(ES.Node.prototype, baseStuff);
  
  /**
  Provides the base Widget class...

  @module widget
  */
  ES.Client = function(cfg) {
    if (typeof cfg === "undefined") cfg = {};
    this.host = Utils.isUndefinedOrNull(cfg.host) ? "127.0.0.1" : cfg.host;
    this.port = Utils.isUndefinedOrNull(cfg.port) ? "9200" : cfg.port;
    this.context = Utils.isUndefinedOrNull(cfg.context) ? "/" : cfg.context;
    this.baseurl = "http://"+this.host+":"+this.port+this.context;
    this.cache = {};
    this.ajax = function(url, data, cacheName, opts) {
      if (!((url.indexOf("http://") == 0) || (url.indexOf("https://") == 0) || (url.indexOf("//") == 0))) {
        url = this.baseurl + url;
      }
      var ajaxOpts = {
        url: url,
        crossDomain: true
      };
      $.extend(ajaxOpts, opts);
      if (!Utils.isUndefinedOrNull(data)) {
        if (typeof data == "object") {
          data = JSON.stringify(data);
        }
        ajaxOpts.data = data;
        if (ajaxOpts.type == "undefined"){
          ajaxOpts.type = "POST"; 
        }
      }
      
      var client = this;
      if (Utils.isUndefinedOrNull(cacheName)) {
        return $.ajax(ajaxOpts).done(function(response) {
          client.cache[cacheName] = response;
        });
      } else {
        return $.ajax(ajaxOpts);
      }
    }    
    this.indices = new ES.Indices(this);
  }



  /**

    ES.Client handles setting up all the root requests for elasticsearch.

    http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/index.html


    @class ES.Client

   */
  $.extend(ES.Client.prototype, {
    "version": function(opts) {
      return this.ajax("", null, "version", opts);
    },
    "nodesStats": function(opts) {
      return this.ajax("_nodes/stats?all=true", null, "stats", opts);
    },
    "nodes": function(opts) {
      return this.ajax("_nodes", null, "nodes", opts);
    },
    "status": function(opts) {
      return this.ajax("_status", null, "status", opts);
    },
    "cluster": function(opts) {
      return this.ajax("_cluster/state", null, "cluster", opts);
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
      return this.ajax(opts._index+"/_bulk", t, null, ajaxOpts);
    },
    "search": function(query, indicies, type, opts) {
      var search = new ES.Search(this, indices, type);
      search.searchUrlVals = opts;
      search.search(query);
    },
    "createSearch": function(indices, type) {
      return new ES.Search(this, indices, type);
    }    
  });

  //http://www.elasticsearch.org/guide/en/elasticsearch/reference/master/indices.html
  ES.Indices = function(client) {
    this.client = client;
  }
  
  $.extend(ES.Indices.prototype, baseStuff, {
    "stats": function(indices, stats) {
      if (Utils.isUndefinedOrNull(indices)) {
        indices = "";
      }
      if (Utils.isUndefinedOrNull(stats)) {
        stats = "_stats";
      }
      if (Array.isArray(indices)) {
        indices = indices.join(",");
      }
      if (Array.isArray(stats)) {
        stats = "_stats/" + stats.join(",");
      }
      if (stats.indexOf("_stats") != 0) {
        stats = "_stats/" + stats;
      }
      var url = indices ? indices + "/" + stats : stats;
      return this.client.ajax(url, null, null, null);
    },
    /**
     Creates an index with basic options or a mapping.

     http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/indices-create-index.html

     @method create
     @param {String} indexName Name of the index
     @param {integer} shardCount number of shards, defaults to 1 if undefined, if null, defaults to whatever server is configured to
     @param {integer} replicaCount number of replicas, defaults to 0 if undefined, if null, defaults to whatever server is configured to.
     @param {Object} opts extra options, formatted as specified in the elasticsearch documentation
     @return {String} response The response from the server.
    */
    "create": function(indexName, shardCount, replicaCount, opts) {
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
      console.log(this.client);
      return this.client.ajax(indexName+"/", opts, null, ajaxOpts);
    },

    /**
      Tests whether an index exists.

      See, it would be tempting to use async here if I didn't understand the promise of promises:
      https://gist.github.com/domenic/3889970

      Great article, now I need to rewrite the docs to reflect this better.

      http://eng.wealthfront.com/2012/12/jquerydeferred-is-most-important-client.html
      http://www.html5rocks.com/en/tutorials/es6/promises/

      http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/indices-exists.html

     @method exists
     @param {String} indexName Name of the index
     @return {boolean} response Interpreted response from server.
    */
    "exists": function(indexName) {
      var ajaxOpts = {
        type: "HEAD"
      };
      return this.client.ajax(indexName+"/", null, null, ajaxOpts).then(function(response, text, xhr) {
        return new jQuery.Deferred().resolve(true);
      }, function() {
        return new jQuery.Deferred().resolve(false);
      });
    },
    
    /**
      Removes an index. Delete is a reserved keyword in JavaScript :(

      http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/indices-delete-index.html

      @method remove
      @param {String} indexName
      @return {boolean} response The response from the server. (true if successful)
    */
    "remove": function(indexName) {
      var ajaxOpts = {
        type: "DELETE"
      };
      return this.client.ajax(indexName+"/", null, null, ajaxOpts).then(function(response, text, xhr) {
        return new jQuery.Deferred().resolve(true);
      }, function() {
        return new jQuery.Deferred().resolve(false);
      });
    }        
  });
  
  
  // http://okfnlabs.org/blog/2013/07/01/elasticsearch-query-tutorial.html#match-all--find-everything
  // http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-request-body.html
  // http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search.html
  ES.Search = function(client, indices, type) {
    if (Utils.isUndefinedOrNull(indices)) {
      indices = "_all";
    } else if (Array.isArray(indices)) {
      indices = indices.join(",");
    }

    if (Utils.isUndefinedOrNull(type)) {
      type = "";
    } else {
      type = "/" + type;
    }

    this.indices = indices;
    this.type = type;
    this.client = client;
    this.post_filter = new ES.Filter(this);
    this.sorts = [];
    this.searchUrlVals = {};
    this.aggs = []; // we're going to implement facets this way of course
    this.query = new ES.Query(this);
  }
      
  $.extend(ES.Search.prototype, {
    "__setField": function(field, val) {
      if (Utils.isUndefinedOrNull(val) && (typeof this.searchUrlVals[field] != "undefined")) {
        delete this.searchUrlVals[field];
        return this;
      }
      this.searchUrlVals[field] = Array.isArray(val) ? val.join(",") : val;
      return this;
    },
    "setDefaultField": function(defaultField) {      
      return this.__setField("df", defaultField);      
    },
    "setAnalyzer": function(analyzer) {
      return this.__setField("analyzer", analyzer);      
    },
    "setDefaultOperator": function(defaultOperator) {
      return this.__setField("default_operator", defaultOperator);      
    },
    "setExplain": function(explain) {
      return this.__setField("explain", explain);      
    },
    "setSource": function(_source) {
      return this.__setField("_source", _source);      
    },    
    "setFields": function(fields) {
      return this.__setField("fields", fields);      
    },
    "setTrackScores": function(trackScores) {
      return this.__setField("track_scores", trackScores);      
    },
    "setTimeout": function(timeout) {
      return this.__setField("timeout", timeout);      
    },
    "setTerminateAfter": function(terminateAfter) {
      return this.__setField("terminate_after", terminateAfter);      
    },
    "setFrom": function(from) {
      return this.__setField("from", from);      
    },    
    "setSize": function(size) {
      return this.__setField("size", size);      
    },
    "setSearchType": function(searchType) {
      return this.__setField("search_type", searchType);      
    },
    "setLowercaseExpandedTerms": function(lowercaseExpandedTerms) {
      return this.__setField("lowercase_expanded_terms", lowercaseExpandedTerms);      
    },
    "setAnalyzeWildcard": function(analyzeWildcard) {      
      return this.__setField("analyze_wildcard", analyzeWildcard);      
    },
    "setPageSize": function(pageSize, page) {
      if (Utils.isUndefinedOrNull(pageSize)) {
        if (this.pageSize) {
          delete this.pageSize;      
        }
      } else {
        this.pageSize = pageSize;
        this.setPage(page);      
      }
      return this;      
    },
    "nextPage": function() {
      if (Utils.isUndefinedOrNull(this.page)) {
        return this.setPage(1);
      }
      return this.setPage(this.page+1);      
    },
    "prevPage": function() {
      if (Utils.isUndefinedOrNull(this.page)) {
        return this.setPage();
      }
      return this.setPage(this.page-1);      
    },
    "setPage": function(page) {
      if (Utils.isUndefinedOrNull(this.pageSize)) {
        return this;
      }
      if (Utils.isUndefinedOrNull(page)) {
        page = 0;        
      }
      if (this.page < 0) {
        page = 0;
      }
      this.page = page;
      return this.__setField("from", this.pageSize * page);
    },
    "setMaxPage": function(maxPage) {
      if (Utils.isUndefinedOrNull(maxPage)) {
        if (this.pageSize) {
          delete this.maxPage;
        }
        return this;
      }
      this.maxPage = maxPage;
      return this;
    },
    "findSort": function(field) {
      for(var x=0;x<this.sorts.size;x++) {
        if (field === this.sorts[x].field) {
          return x;
        }
      }
      return -1;      
    },
    "moveSortTo": function(field, newIndex) {
      var idx = this.findSort(field);
      if (idx == -1) {
          return this;
      }
      Utils.array_move(this.sorts, idx, newIndex);
      return this;
    },
    "addSort": function(field, order, mode, missing) {
      var sortObj = {"field": field};
      var idx = this.findSort(field);
      if (idx == -1) {
          idx = this.sorts.length;
          this.sorts.push({"field": field, "order": order, "mode": mode, "missing": missing});          
      } else {
          this.sorts[idx] = {"field": field, "order": order, "mode": mode, "missing": missing}; // update
      }
      return this;
    },    
    "removeSort": function(field, order, mode, missing) {
      var idx = this.findSort(field);
      if (idx != -1) {
        Utils.array_remove(idx);
        return this;
      }
      return this;
    },
    "getSearchURL": function(simpleQuery) {      
      var url = this.client.baseurl+this.indices+this.type+"/_search"; 
      if (Utils.isUndefinedOrNull(simpleQuery) || (!simpleQuery)) {
        return url;  
      } 
      return url + "?" + Utils.serialize(this.searchUrlVals);
    },    
    "getBody": function() {
      var querySearchBody = {};      
      var queryPart = this.query.getBody();
      if (queryPart != null) {
        querySearchBody.query = queryPart.query; // the root search should only have a query part, the filter portion is delegated to the post_filter, any filters are sub-filters of the query
      }
      var filterPart = this.post_filter.getBody();
      if (filterPart != null) {
        querySearchBody.post_filter = filterPart;
      }
      console.log(querySearchBody);
      return querySearchBody;
    },
    /**
      http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-query-string-query.html

      @method search Performs a basic query      
    */
    "simpleQueryStringSearch": function(queryString, cacheName) {
      this.searchUrlVals.q = queryString;
      return this.client.ajax(this.getSearchURL(true), null, cacheName, null);      
    },
    "execute": function(cacheName) {
      var ajaxOpts = {
        type: "POST"
      };
      return this.client.ajax(this.getSearchURL(true), this.getBody(), cacheName, ajaxOpts);
    }
  });
  
  ES.Bool = function(parent) {
    this.conds = {};
    this.parent = parent;
  }

  $.extend(ES.Bool.prototype, baseStuff, {    
    "getBody": function() {
      var result = {};
      if (this.conds['should']) {
        result.should = [];
        for(var x=0;x<this.conds['should'].length;x++) {          
          var q = this.conds['should'][x];          
          console.log("xxxxxxxx",this.conds, result, q);
          result.should.push(q.getBody());
        }
      }
      if (this.conds['must']) {
        result.must = this.conds.must.getBody();
      }
      if (this.conds['must_not']) {
        result.must_not = this.conds.must_not.getBody();
      }
      return result;
    },
    "should": function() {
      if (typeof this.conds['should'] == "undefined") {
        this.conds['should'] = [];
      }      
      var q = new ES.Query(this, true);
      this.conds['should'].push(q);
      return q;
    },
    "must": function() {
      if (typeof this.conds['must'] == "undefined") {
        this.conds['must'] = new ES.Query(this);
      }
      return this.conds['must'];
    },
    "must_not": function() {
      if (typeof this.conds['must_not'] == "undefined") {
        this.conds['must_not'] = new ES.Query(this);
      }
      return this.conds['must_not'];
    },
    "boost": function(val) {
      this.boost = val;
    },
    "minimum_should_match": function(val) {
      this.minimum_should_match = val;
    }
  });  
   
  // http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-queries.html
  ES.Query = function(parent, queryOnly) {
    this.parent = parent;
    this.query = {};    
    this.objs = {};    
    this.queryOnly = ((typeof queryOnly != "undefined") && queryOnly) ? queryOnly : false;
    this.filter = new ES.Filter(this);
  }
  
  $.extend(ES.Query.prototype, baseStuff, {        
    "matchAll": function() {
      this.query.matchAll = function() {
        return {};
      }
      return this.parent;
    },
    "getBody": function() {
      var querySearchBody = {};
      //console.log("--------", this.query);
      var queryPart = Utils.getQueryDSLStruct(this.query);
      //console.log(queryPart);
      if (queryPart != null) {
        if (this.queryOnly) {
          return queryPart;
        }
        querySearchBody.query = queryPart; 
      }      
      var filterPart = this.filter.getBody();
      if (filterPart != null) {
        querySearchBody.query.filter = filterPart;
      }
      if (Object.keys(querySearchBody).length > 0) {
        return querySearchBody;
      } else {
        return null;
      }
    },    
    "filtered": function() {      
      if (!this.query.filtered) {
        var subQuery = new ES.Query(this.parent);      
        this.query.filtered = new ES.Node(this, subQuery.getBody);
      }
      return this.query.filtered.subQuery;      
      return subQuery;
    },
    "bool": function(cond) {
      if (typeof this.query.bool == "undefined") {             
        this.query.bool = new ES.Bool(this);        
      }
      if (typeof cond != "undefined") {        
        return this.query.bool[cond]();
      } else {
        return this.query.bool;        
      }
    },    
    /**
      Matches documents that have fields containing terms with a specified prefix (not analyzed). The prefix query maps to Lucene PrefixQuery. 
      
      TODO: perhaps we'll restructure this to // prefix: function(field, value, boost), returning a ES.Prefix obj
      
      http://www.elasticsearch.org/guide/en/elasticsearch/reference/master/query-dsl-prefix-query.html

      @method prefix Matches documents that have fields containing terms with a specified prefix (not analyzed).
      @param {Object} fieldValueBoostPairs Object that adheres to the following format 
                 {"<term_name>": {"value": "<prefix_to_match>", "boost": "<boost_val>"}} 
                 only one prefix to match per term, otherwise use a should
                 https://gist.github.com/jprante/bdf9a9755a64bc23afbe
      @param {float} commonBoost - boost all prefix terms by a given amount (can be overridden by each pair)
      @param {String} rewrite http://www.elasticsearch.org/guide/en/elasticsearch/reference/master/query-dsl-multi-term-rewrite.html
      @return {boolean} response The response from the server. (true if successful)
    */    
    "prefix": function(fieldValueBoostPairs, commonBoost, rewrite) {            
      if (typeof this.query.prefix == "undefined") {
        this.query.prefix = new ES.Node(this, function() {
          var keys = Object.keys(fieldValueBoostPairs);
          var prefixCfg = {};
          for(var x=0;x<keys.length;x++) {
            prefixCfg[keys[x]] = {"value": fieldValueBoostPairs[keys[x]].value};
            if (typeof fieldValueBoostPairs[keys[x]].boost != "undefined") {
              prefixCfg[keys[x]].boost = fieldValueBoostPairs[keys[x]].boost;
            } else if (!Utils.isUndefinedOrNull(commonBoost)) {
              prefixCfg[keys[x]].boost = commonBoost;
            }                   
          }
          if (!Utils.isUndefinedOrNull(rewrite)) {
            prefixCfg.rewrite = rewrite; 
          }
          return prefixCfg;
        });
      };      
      return this.query.prefix;
    },
    
    /**
      A query that wraps a filter or another query and simply returns a constant score equal to the query boost for every document in the filter.
      
      http://www.elasticsearch.org/guide/en/elasticsearch/reference/master/query-dsl-constant-score-query.html

      @method prefix
      @param {Object} fieldPrefixAndBoostPairs
      @param {float} commonBoost - boost all prefix terms by a given amount (can be overridden by each pair)
      @param {String} rewrite http://www.elasticsearch.org/guide/en/elasticsearch/reference/master/query-dsl-multi-term-rewrite.html
      @return {boolean} response The response from the server. (true if successful)
    */
    "constant_score": function(score) {           
      var subQuery = new ES.Query(this.parent);
      this.query.constant_score = function() {        
        var queryPart = this.subQuery.getBody();
        queryPart = queryPart == null ? {} : queryPart;
        var scorePart = Utils.isUndefinedOrNull(score) ? {} : {boost: score};
        return $.extend({}, queryPart, scorePart);
      }
      return subQuery;
    }
    
  });

  // http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-filters.html
  ES.Filter = function(parent) {
    this.parent = parent;
    this.filter = {};
  }

  $.extend(ES.Filter.prototype, baseStuff, {        
    "getBody": function() {
      var filterPart = Utils.getQueryDSLStruct(this.filter);
      if (filterPart == null) {
        return null;
      } else {
        return filterPart;
      }      
    },
    "term": function(term, values, opts) {      
      this.filter.term = new ES.Node(this, function() {
          var t = {};
          t[term] = values;
          return t;
      });
      return this.filter.term; 
    }
  })  

	window.ES = ES;
	return ES;
});