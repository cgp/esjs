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
   "getVal": function(val) {
        if (typeof val == "function") {
          return val();
        }
        if (Array.isArray(val)) {
          var result = [];
          for(var x=0;x<val.length;x++) {
            result.push(Utils.getVal(val[x]));
          }
          return result;
        }
        if ((typeof val == "object") && (val.getBody)) {
          return val.getBody();
        }
        return val;
   },
   "getQueryDSLStruct": function(queryDSLStruct) {
      // ends up getting used by Search,Query,Filter, so Utils is the most logical location
      //console.log(queryDSLStruct);
      var keys = Object.keys(queryDSLStruct);
      if (keys.length == 0) {
        return null;
      }
      var body = {};
      for(var x=0;x<keys.length;x++) {
        body[keys] = Utils.getVal(queryDSLStruct[keys[x]]);
      }
      return body;
    }
  };

  // From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys -- removed unless I hear complaints
	var ES = {};
  ES.Node = function(parent, getBodyFunc, subqueryFields, subqueryArrayFields) {
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

  ES.FieldTypes = {
    "Bool": {'fields': {
                'must': {'type': 'queryArray'},
                'should': {'type': 'queryArray'},
                'must_not': {'type': 'queryArray'},
                'minimum_should_match': {'type': 'value'},
                'boost': {'type': 'value'},
             },
             'accessor': 'simpleType'
            },
    "Boosting": {'fields': {
                   'positive': {'type': 'queryArray'},
                   'negative': {'type': 'queryArray'},
                   'boost': {'type': 'value'},
                   'negative_boost': {'type': 'value'},
                 },
             'accessor': 'simpleType'
     },             
    "DisMax": {'fields': {
                 'queries': {'type': 'queryArray'},
                 'boost': {'type': 'value'},
                 'tie_breaker': {'type': 'value'},
                },
             'accessor': 'simpleType'
    },
    "FuzzyLikeThis": {'fields': {
                         'fields': {'type': 'value'},
                         'like_text': {'type': 'value'},
                         'ignore_tf': {'type': 'value'},
                         'max_query_terms': {'type': 'value'},
                         'fuzziness': {'type': 'value'},
                         'prefix_length': {'type': 'value'},
                         'boost': {'type': 'value'},
                         'analyzer': {'type': 'value'}
                     },
              'accessor': 'simpleType'
    },
    "HasChild": {'fields': {
                   'query': {'type': 'queryTypeValue'},
                   'type': {'type': 'value'},
                   'filter': {'type': 'filterTypeValue'},
                },
              'accessor': 'simpleType'
    },    
    "queryArray": {
      "accessor": function(fieldName) {
        return function() {
            if (typeof this.values[fieldName] == "undefined") {
              this.values[fieldName] = [];
            }
            var q = new ES.Query(this, true);
            this.values[fieldName].push(q);
            return q;
        };
      }
    },    
    "value": {
      "accessor": function(fieldName) {
        return function(value) {
            this.values[fieldName] = value;
            return this;
        };
      }
    },
    "commonValue": {
      "accessor": function(fieldName) {
        return function(term, query, cutoff_frequency, low_freq_operator,  minimum_should_match) {            
            this.values[fieldName][term] = {};
            this.values[fieldName][term].query = query;
            this.values[fieldName][term].cutoff_frequency = cutoff_frequency;
            if (!Utils.isUndefinedOrNull(low_freq_operator)) {
              this.values[fieldName][term].low_freq_operator = low_freq_operator;
            }
            if (!Utils.isUndefinedOrNull(minimum_should_match)) {
              this.values[fieldName][term].low_freq_operator = minimum_should_match;
            }
            return this;
        };
      }
    },
    "fuzzyValue": {
      "accessor": function(fieldName) {
        return function(term, value, boost, fuzziness,  prefix_length, max_expansions) {            
            this.values[fieldName][term] = {};
            this.values[fieldName][term].value = value;
            if (!Utils.isUndefinedOrNull(boost)) { this.values[fieldName][term].boost = boost; }
            if (!Utils.isUndefinedOrNull(fuzziness)) { this.values[fieldName][term].fuzziness = fuzziness; }
            if (!Utils.isUndefinedOrNull(prefix_length)) { this.values[fieldName][term].prefix_length = prefix_length; }
            if (!Utils.isUndefinedOrNull(max_expansions)) { this.values[fieldName][term].max_expansions = max_expansions; }
            return this;
        };
      }
    },
    "geoShapeValue": { //// http://www.elasticsearch.org/guide/en/elasticsearch/reference/master/mapping-geo-shape-type.html
      "accessor": function(fieldName) {
        return function(term, shapeType, coordinates_or_id, type, index, path) {            
            this.values[fieldName][term] = {};
            if (shapeType == "indexed_shape") {
              this.values[fieldName][term].shape = {};
              this.values[fieldName][term].shape.coordinates = coordinates_or_id;
              this.values[fieldName][term].shape.type = shapeType;            
            } else {
              this.values[fieldName][term].indexed_shape = {
                        "id": coordinates_or_id,
                        "type": type,
                        "index": index,
                        "path": path
              };
            }
            return this;
        };
      }
    },    
    "queryTypeValue": {
      "accessor": function(fieldName) {
        return function() {
            if (typeof this.values[fieldName] == "undefined") {
              this.values[fieldName] = new ES.Query(this, true);
            }            
            return this.values[fieldName];
        };
      }
    },
    "filterTypeValue": {
      "accessor": function(fieldName) {
        return function() {
            if (typeof this.values[fieldName] == "undefined") {
              this.values[fieldName] = new ES.Filter(this);
            }            
            return this.values[fieldName];
        };
      }
    },
  };
  
  function createType(typeInfo) {
    var FieldType = function(parent) {
      this.parent = parent;
      this.values = {};      
      for(fieldName in typeInfo.fields) {        
        this[fieldName] = ES.FieldTypes[typeInfo.fields[fieldName].type].accessor(fieldName);
      }      
      this.getBody = function() { return Utils.getQueryDSLStruct(this.values); }
    }    
    $.extend(FieldType.prototype, baseStuff);    
    typeInfo.accessor = function(fieldName) {
          return function() {
            if (typeof this.values[fieldName] == "undefined") {
              this.values[fieldName] = new FieldType(this);
            }
            return this.values[fieldName];
          };        
    };
    console.log(typeInfo.accessor);
    return FieldType;
  }
  
  for(type in ES.FieldTypes) {
    if (typeof ES.FieldTypes[type].accessor == "string") {      
      ES.FieldTypes[type].constructor = createType(ES.FieldTypes[type]); //sets the accessor and the constructor for a simple type       
    }
  }      
  
  // http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-queries.html
  ES.Query = function(parent, queryOnly) {
    this.parent = parent;
    this.values = {};
    var fields = {
       'boosting': {'type': 'Boosting'},
       'bool': {'type': 'Bool'},
       'dis_max': {'type': 'DisMax'},
       'flt': {'type': 'FuzzyLikeThis'},
       'fuzzy_like_this': {'type': 'FuzzyLikeThis'},
       'fuzzy': {'type': 'fuzzyValue'},
       'geo_shape': {'type': 'geoShapeValue'},
       'has_child': {'type': 'HasChild'}
    };
    for(fieldName in fields) {
      console.log(fieldName);
       this[fieldName] = ES.FieldTypes[fields[fieldName].type].accessor(fieldName);
    }
    this.queryOnly = ((typeof queryOnly != "undefined") && queryOnly) ? queryOnly : false;
    this.filter = new ES.Filter(this);
  }

  $.extend(ES.Query.prototype, baseStuff, {
    "getBody": function() {
      var querySearchBody = {};
      //console.log("--------", this.values);
      var queryPart = Utils.getQueryDSLStruct(this.values);
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
      this.values.constant_score = function() {
        var queryPart = this.subQuery.getBody();
        queryPart = queryPart == null ? {} : queryPart;
        var scorePart = Utils.isUndefinedOrNull(score) ? {} : {boost: score};
        return $.extend({}, queryPart, scorePart);
      }
      return subQuery;
    },
    "filtered": function() {
      if (!this.values.filtered) {
        var subQuery = new ES.Query(this.parent);
        this.values.filtered = new ES.Node(this, subQuery.getBody);
      }
      return this.values.filtered.subQuery;
      return subQuery;
    },
    "matchAll": function() {
      this.values.matchAll = new ES.Node(this, function() {
        return {};
      });
      return this.values.matchAll;
    },
    /**
      Matches documents that have fields containing terms with a specified prefix (not analyzed). The prefix query maps to Lucene PrefixQuery.

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
      if (typeof this.values.prefix == "undefined") {
        this.values.prefix = new ES.Node(this, function() {
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
      return this.values.prefix;
    },
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