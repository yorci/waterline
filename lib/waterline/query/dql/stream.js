/**
 * Module dependencies
 */

var _ = require('lodash');
var async = require('async');
var flaverr = require('flaverr');
var forgeStageTwoQuery = require('../../utils/forge-stage-two-query');
var Deferred = require('../deferred');


/**
 * stream()
 *
 * Iterate over individual records (or batches of records) that match
 * the specified criteria, populating associations if instructed.
 *
 * ```
 * BlogPost.stream()
 *   .limit(50000)
 *   .sort('title ASC')
 *   .eachRecord(function (blogPost, next){ ... })
 *   .exec(function (err){ ... });
 *
 * // For more usage info, see:
 * // https://gist.github.com/mikermcneil/d1e612cd1a8564a79f61e1f556fc49a6#examples
 * ```
 *
 *  -------------------------------
 *  ~• This is "the new stream". •~
 *  -------------------------------
 *
 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
 *
 * Usage without deferred object:
 * ================================================
 *
 * @param {Dictionary?} criteria
 *
 * @param {Function?} eachRecordFn
 *
 * @param {Dictionary} moreQueryKeys
 *        For internal use.
 *        (A dictionary of query keys.)
 *
 * @param {Function?} done
 *        Callback function to run when query has either finished successfully or errored.
 *        (If unspecified, will return a Deferred object instead of actually doing anything.)
 *
 * @param {Ref?} meta
 *     For internal use.
 *
 * @returns {Ref?} Deferred object if no `done` callback was provided
 *
 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
 *
 * The underlying query keys:
 * ==============================
 *
 * @qkey {Dictionary?} criteria
 *
 * @qkey {Dictionary?} populates
 *
 * @qkey {Function?} eachRecordFn
 *        An iteratee function to run for each record.
 *        (If specified, then `eachBatchFn` should not ALSO be set.)
 *
 * @qkey {Function?} eachBatchFn
 *        An iteratee function to run for each batch of records.
 *        (If specified, then `eachRecordFn` should not ALSO be set.)
 *
 * @qkey {Dictionary?} meta
 * @qkey {String} using
 * @qkey {String} method
 *
 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
 */

module.exports = function stream( /* criteria?, eachRecordFn?, moreQueryKeys?, done?, meta? */ ) {


  // Build query w/ initial, universal keys.
  var query = {
    method: 'stream',
    using: this.identity
  };


  //  ██╗   ██╗ █████╗ ██████╗ ██╗ █████╗ ██████╗ ██╗ ██████╗███████╗
  //  ██║   ██║██╔══██╗██╔══██╗██║██╔══██╗██╔══██╗██║██╔════╝██╔════╝
  //  ██║   ██║███████║██████╔╝██║███████║██║  ██║██║██║     ███████╗
  //  ╚██╗ ██╔╝██╔══██║██╔══██╗██║██╔══██║██║  ██║██║██║     ╚════██║
  //   ╚████╔╝ ██║  ██║██║  ██║██║██║  ██║██████╔╝██║╚██████╗███████║
  //    ╚═══╝  ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝ ╚═════╝╚══════╝
  //

  // The `done` callback, if one was provided.
  var done;

  // Handle the various supported usage possibilities
  // (locate the `done` callback, and extend the `query` dictionary)
  //
  // > Note that we define `args` so that we can insulate access
  // > to the arguments provided to this function.
  var args = arguments;
  (function _handleVariadicUsage(){

    // Additional query keys.
    var _moreQueryKeys;

    // The metadata container, if one was provided.
    var _meta;


    // Handle double meaning of first argument:
    //
    // • stream(criteria, ...)
    if (_.isObject(args[0]) && !_.isFunction(args[0]) && !_.isArray(args[0])) {
      query.criteria = args[0];
    }
    // • stream(eachRecordFn, ...)
    else {
      query.eachRecordFn = args[0];
    }


    // Handle double meaning of second argument:
    //
    // • stream(..., _moreQueryKeys, done, _meta)
    var is2ndArgDictionary = (_.isObject(args[1]) && !_.isFunction(args[1]) && !_.isArray(args[1]));
    if (is2ndArgDictionary) {
      _moreQueryKeys = args[1];
      done = args[2];
      _meta = args[3];
    }
    // • stream(..., eachRecordFn, ...)
    else {
      query.eachRecordFn = args[1];
    }


    // Handle double meaning of third argument:
    //
    // • stream(..., ..., _moreQueryKeys, done, _meta)
    var is3rdArgDictionary = (_.isObject(args[2]) && !_.isFunction(args[2]) && !_.isArray(args[2]));
    if (is3rdArgDictionary) {
      _moreQueryKeys = args[2];
      done = args[3];
      _meta = args[4];
    }
    // • stream(..., ..., done, _meta)
    else {
      done = args[2];
      _meta = args[3];
    }


    // Fold in `_moreQueryKeys`, if provided.
    //
    // > Userland is prevented from overriding any of the universal keys this way.
    if (!_moreQueryKeys) {
      delete _moreQueryKeys.method;
      delete _moreQueryKeys.using;
      delete _moreQueryKeys.meta;
      _.extend(query, _moreQueryKeys);
    }//>-


    // Fold in `_meta`, if provided.
    if (!_meta) {
      query.meta = _meta;
    }//>-

  })();//</self-calling function :: handleVariadicUsage()>




  //  ██████╗ ███████╗███████╗███████╗██████╗
  //  ██╔══██╗██╔════╝██╔════╝██╔════╝██╔══██╗
  //  ██║  ██║█████╗  █████╗  █████╗  ██████╔╝
  //  ██║  ██║██╔══╝  ██╔══╝  ██╔══╝  ██╔══██╗
  //  ██████╔╝███████╗██║     ███████╗██║  ██║
  //  ╚═════╝ ╚══════╝╚═╝     ╚══════╝╚═╝  ╚═╝
  //
  //   ██╗███╗   ███╗ █████╗ ██╗   ██╗██████╗ ███████╗██╗
  //  ██╔╝████╗ ████║██╔══██╗╚██╗ ██╔╝██╔══██╗██╔════╝╚██╗
  //  ██║ ██╔████╔██║███████║ ╚████╔╝ ██████╔╝█████╗   ██║
  //  ██║ ██║╚██╔╝██║██╔══██║  ╚██╔╝  ██╔══██╗██╔══╝   ██║
  //  ╚██╗██║ ╚═╝ ██║██║  ██║   ██║   ██████╔╝███████╗██╔╝
  //   ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═════╝ ╚══════╝╚═╝
  //
  //  ┌┐ ┬ ┬┬┬  ┌┬┐   ┬   ┬─┐┌─┐┌┬┐┬ ┬┬─┐┌┐┌  ┌┐┌┌─┐┬ ┬  ┌┬┐┌─┐┌─┐┌─┐┬─┐┬─┐┌─┐┌┬┐
  //  ├┴┐│ │││   ││  ┌┼─  ├┬┘├┤  │ │ │├┬┘│││  │││├┤ │││   ││├┤ ├┤ ├┤ ├┬┘├┬┘├┤  ││
  //  └─┘└─┘┴┴─┘─┴┘  └┘   ┴└─└─┘ ┴ └─┘┴└─┘└┘  ┘└┘└─┘└┴┘  ─┴┘└─┘└  └─┘┴└─┴└─└─┘─┴┘
  //  ┌─    ┬┌─┐  ┬─┐┌─┐┬  ┌─┐┬  ┬┌─┐┌┐┌┌┬┐    ─┐
  //  │───  │├┤   ├┬┘├┤ │  ├┤ └┐┌┘├─┤│││ │   ───│
  //  └─    ┴└    ┴└─└─┘┴─┘└─┘ └┘ ┴ ┴┘└┘ ┴     ─┘
  // If a callback function was not specified, then build a new `Deferred` and bail now.
  //
  // > This method will be called AGAIN automatically when the Deferred is executed.
  // > and next time, it'll have a callback.
  if (!done) {
    return new Deferred(this, stream, query);
  }//--•



  // Otherwise, IWMIH, we know that a callback was specified.
  // So...
  //
  //  ███████╗██╗  ██╗███████╗ ██████╗██╗   ██╗████████╗███████╗
  //  ██╔════╝╚██╗██╔╝██╔════╝██╔════╝██║   ██║╚══██╔══╝██╔════╝
  //  █████╗   ╚███╔╝ █████╗  ██║     ██║   ██║   ██║   █████╗
  //  ██╔══╝   ██╔██╗ ██╔══╝  ██║     ██║   ██║   ██║   ██╔══╝
  //  ███████╗██╔╝ ██╗███████╗╚██████╗╚██████╔╝   ██║   ███████╗
  //  ╚══════╝╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═════╝    ╚═╝   ╚══════╝


  //  ╔═╗╔═╗╦═╗╔═╗╔═╗  ┌─┐┌┬┐┌─┐┌─┐┌─┐  ┌┬┐┬ ┬┌─┐  ┌─┐ ┬ ┬┌─┐┬─┐┬ ┬
  //  ╠╣ ║ ║╠╦╝║ ╦║╣   └─┐ │ ├─┤│ ┬├┤    │ ││││ │  │─┼┐│ │├┤ ├┬┘└┬┘
  //  ╚  ╚═╝╩╚═╚═╝╚═╝  └─┘ ┴ ┴ ┴└─┘└─┘   ┴ └┴┘└─┘  └─┘└└─┘└─┘┴└─ ┴
  //
  // Forge a stage 2 query (aka logical protostatement)
  try {
    forgeStageTwoQuery(query, this.waterline);
  } catch (e) {
    switch (e.code) {

      case 'E_INVALID_STREAM_ITERATEE':
        return done(
          flaverr(
            { name: 'Usage error' },
            new Error(
              'An iteratee function (or "cursor") should be passed in to `.stream()` via either ' +
              '`.eachRecord()` or `eachBatch()` -- but not both.\n' +
              'Details:\n' +
              '  ' + e.message + '\n'
            )
          )
        );

      case 'E_INVALID_CRITERIA':
        return done(
          flaverr(
            { name: 'Usage error' },
            new Error(
              'Invalid criteria.\n' +
              'Details:\n' +
              '  ' + e.message + '\n'
            )
          )
        );

      case 'E_INVALID_POPULATES':
        return done(
          flaverr(
            { name: 'Usage error' },
            new Error(
              'Invalid populate(s).\n' +
              'Details:\n' +
              '  ' + e.message + '\n'
            )
          )
        );

      default:
        return done(e);
    }
  } //>-•



  //  ┌┐┌┌─┐┬ ┬  ╔═╗╔═╗╔╦╗╦ ╦╔═╗╦  ╦ ╦ ╦  ┌┬┐┌─┐┬  ┬┌─  ┌┬┐┌─┐  ┌┬┐┬ ┬┌─┐  ┌┬┐┌┐ ┌─┐
  //  ││││ ││││  ╠═╣║   ║ ║ ║╠═╣║  ║ ╚╦╝   │ ├─┤│  ├┴┐   │ │ │   │ ├─┤├┤    ││├┴┐└─┐
  //  ┘└┘└─┘└┴┘  ╩ ╩╚═╝ ╩ ╚═╝╩ ╩╩═╝╩═╝╩    ┴ ┴ ┴┴─┘┴ ┴   ┴ └─┘   ┴ ┴ ┴└─┘  ─┴┘└─┘└─┘
  //
  //
  // - - - • - - - - - - • - - - - - - • - - - - - - • - - - - - - • - - - - - - • - - -
  // This is specced out (and mostly implemented) here:
  // https://gist.github.com/mikermcneil/d1e612cd1a8564a79f61e1f556fc49a6
  // - - - • - - - - - - • - - - - - - • - - - - - - • - - - - - - • - - - - - - • - - -
  // return done(new Error('Not implemented yet.'));
  // - - - • - - - - - - • - - - - - - • - - - - - - • - - - - - - • - - - - - - • - - -
  // - - - • - - - - - - • - - - - - - • - - - - - - • - - - - - - • - - - - - - • - - -


  // When running a `.stream()`, Waterline grabs pages of like 30 records at a time.
  // This is not currently configurable.
  //
  // > If you have a use case for changing this page size dynamically, please create
  // > an issue with a detailed explanation.  Wouldn't be hard to add, we just haven't
  // > run across a need to change it yet.
  var BATCH_SIZE = 30;

  // A flag that will be set to true after we've reached the VERY last batch.
  var reachedLastBatch;

  // The index of the current batch.
  var i = 0;

  async.doWhilst(function(){
    if (reachedLastBatch) { return true; }
    else { return false; }
  }, function (next) {

    // Build the deferred object to do a `.find()` for this batch.
    var deferredForThisBatch = RelevantModel.find({
      skip: (
        ( query.skip ) +
        ( i*BATCH_SIZE )
      ),
      limit: Math.max(
        BATCH_SIZE,
        query.limit - (
          ( query.skip ) +
          ( (i+1)*BATCH_SIZE )
        )
      ),
      sort: query.sort,
      where: query.where
    });

    _.each(query.populates, function (assocCriteria, assocName){
      deferredForThisBatch.populate(assocName, assocCriteria);
    });

    deferredForThisBatch.exec(function (err, batchOfRecords){
      if (err) { return next(err); }

      // If there were no records returned, then we have already reached the last batch of results.
      // (i.e. it was the previous batch-- since this batch was empty)
      // In this case, we'll set the `reachedLastPage` flag and trigger our callback,
      // allowing `async.doWhilst()` to call _its_ callback, which will pass control back
      // to userland.
      if (batchOfRecords.length === 0) {
        reachedLastPage = true;
        return next();
      }// --•

      // But otherwise, we need to go ahead and call the appropriate
      // iteratee for this batch.  If it's eachBatchFn, we'll call it
      // once.  If it's eachRecordFn, we'll call it once per record.
      (function _makeCallOrCallsToAppropriateIteratee(proceed){

        // If an `eachBatchFn` iteratee was provided, we'll call it.
        // > At this point we already know it's a function, because
        // > we validated usage at the very beginning.
        if (query.eachBatchFn) {
          try {
            query.eachBatchFn(batchOfRecords, proceed);
            return;
          } catch (e) { return proceed(e); }
        }//--•

        // Otherwise `eachRecordFn` iteratee must have been provided.
        // We'll call it once per record in this batch.
        // > We validated usage at the very beginning, so we know that
        // > one or the other iteratee must have been provided as a
        // > valid function if we made it here.
        async.eachSeries(batchOfRecords, function (record, next) {
          try {
            query.eachRecordFn(batchOfRecords, next);
            return;
          } catch (e) { return next(e); }
        }, function (err) {
          if (err) { return proceed(err); }

          return proceed();

        });//</async.eachSeries()>

      })(function (err){
        if (err) {
          // todo: coerce `err` into Error instance, if it's not one already (see gist)
          return next(err);
        }//--•

        // Increment the page counter.
        i++;

        // On to the next page!
        return next();

      });//</self-calling function :: process this batch by making either one call or multiple calls to the appropriate iteratee>

    });//</deferredForThisBatch.exec()>

  }, function (err) {
    if (err) { return done(err); }//-•

    return done();

  });//</async.doWhilst()>

};

