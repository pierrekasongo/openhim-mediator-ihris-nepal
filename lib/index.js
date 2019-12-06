#!/usr/bin/env node
'use strict'

const express = require('express')
const medUtils = require('openhim-mediator-utils')
const winston = require('winston')
const request = require('request')
const URI = require('urijs')
const utils = require('./utils')
const bodyParser = require('body-parser')


const https = require('https')
const http = require('http')


https.globalAgent.maxSockets = 32
http.globalAgent.maxSockets = 32

// Logging setup
winston.remove(winston.transports.Console)
winston.add(winston.transports.Console, {level: 'info', timestamp: true, colorize: true})

// Config
var config = {} // this will vary depending on whats set in openhim-core
const apiConf = process.env.NODE_ENV === 'test' ? require('../config/test') : require('../config/config')
const mediatorConfig = require('../config/mediator')

var port = process.env.NODE_ENV === 'test' ? 7001 : mediatorConfig.endpoints[0].port

/**
 * setupApp - configures the http server for this mediator
 *
 * @return {express.App}  the configured http server
 */
function setupApp () {
  const app = express()

  app.use(bodyParser.json())

  function updateTransaction(req, body, statatusText, statusCode, orchestrations) {
    const transactionId = req.headers['x-openhim-transactionid']

    var update = {
      'x-mediator-urn': mediatorConfig.urn,
      status: statatusText,
      response: {
        status: statusCode,
        timestamp: new Date(),
        body: body
      },
      orchestrations: orchestrations
    }
    medUtils.authenticate(apiConf.api, function (err) {
      if (err) {
        return winston.error(err.stack);
      }
      var headers = medUtils.genAuthHeaders(apiConf.api)
      var options = {
        url: apiConf.api.apiURL + '/transactions/' + transactionId,
        headers: headers,
        json: update
      }

      request.put(options, function (err, apiRes, body) {
        if (err) {
          return winston.error(err);
        }
        if (apiRes.statusCode !== 200) {
          return winston.error(new Error('Unable to save updated transaction to OpenHIM-core, received status code ' + apiRes.statusCode + ' with body ' + body).stack);
        }
        winston.info('Successfully updated transaction with id ' + transactionId);
      });
    })
  }

  app.post('/api/v1/updatePractitioner', function (req, res) {

    let orchestrations = []
    winston.info(`Processing ${req.method} request on ${req.url}`)
    var body = req.body

    var nhwrusername = config.nhwr.username
    var nhwrpassword = config.nhwr.password
    //res.end()
    //updateTransaction(req, "Still Processing", "Processing", "200", "")

    var nhwrurl = new URI(config.nhwr.url).segment('/updatePractitioner/Practitioner')
    var nhwrauth = "Basic " + new Buffer(nhwrusername + ":" + nhwrpassword).toString("base64")
   
    var body = JSON.stringify(body)
    var nhwroptions = {
      url: nhwrurl.toString(),
      body: body,
      headers: {
        Authorization: nhwrauth,
        'Content-Type': 'application/json'
      }
    }

    let before = new Date()

    request.post(nhwroptions, function (err, resp, body) {


      if (err) {
        winston.info('Failed to post Data ' + nhwroptions.body)
      
        return;
      }else{
       
        orchestrations.push(utils.buildOrchestration('Posting Practitioner data to NHWR', before, 'POST', nhwrurl.toString(), JSON.stringify(nhwroptions.headers), nhwroptions.body , resp, body))

        //updateTransaction(req, "", "Successful", "200", orchestrations)
        res.set('Content-Type', 'application/json+openhim');
        res.send(body)
      }

    })
    

  })

  app.get('/api/v1/getPractitioners/:field?/:value?', function (req, res) {

    let orchestrations = []
    winston.info(`Processing ${req.method} request on ${req.url}`)
    var field = req.params.field
    var value = req.params.value
    var nhwrusername = config.nhwr.username
    var nhwrpassword = config.nhwr.password
    //res.end()
    //updateTransaction(req, "Still Processing", "Processing", "200", "")

    if(field && value){
      var nhwrurl = new URI(config.nhwr.url).segment('/api/Practitioner').addQuery('_format' , 'json' ).addSearch('_'+field, value)
    }else {
      var nhwrurl = new URI(config.nhwr.url).segment('/api/Practitioner').addQuery('_format' , 'json' )
    }
    var nhwrauth = "Basic " + new Buffer(nhwrusername + ":" + nhwrpassword).toString("base64")
    var nhwroptions = {
      url: nhwrurl.toString(),
      headers: {
        Authorization: nhwrauth,
        'Content-Type': 'application/json'
      }
    }
   
    let before = new Date()
    request.get(nhwroptions, (err, resp, body) => {
      var responseBody
      if (err) {
        responseBody = body
        winston.info('Failed to get Data ' + responseBody)
      }else{
        responseBody = body
        winston.info(`Processed ${req.method} request on ${req.url}`)
      }
      orchestrations.push(utils.buildOrchestration('Fetching Records from NHWR ', before, 'GET', nhwrurl.toString(), JSON.stringify(nhwroptions.headers), resp, body))    
      
      res.send(responseBody)
    })

    //updateTransaction(req, "", "Successful", "200", orchestrations)
  })

  return app
}

/**
 * start - starts the mediator
 *
 * @param  {Function} callback a node style callback that is called once the
 * server is started
 */
function start (callback) {
  if (apiConf.api.trustSelfSigned) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0' }

  if (apiConf.register) {
    medUtils.registerMediator(apiConf.api, mediatorConfig, (err) => {
      if (err) {
        winston.error('Failed to register this mediator, check your config')
        winston.error(err.stack)
        process.exit(1)
      }
      apiConf.api.urn = mediatorConfig.urn
      medUtils.fetchConfig(apiConf.api, (err, newConfig) => {
        winston.info('Received initial config:')
        winston.info(JSON.stringify(newConfig))
        config = newConfig
        if (err) {
          winston.error('Failed to fetch initial config')
          winston.error(err.stack)
          process.exit(1)
        } else {
          winston.info('Successfully registered mediator!')
          let app = setupApp()
          const server = app.listen(port, () => {
            if (apiConf.heartbeat) {
              let configEmitter = medUtils.activateHeartbeat(apiConf.api)
              configEmitter.on('config', (newConfig) => {
                winston.info('Received updated config:')
                winston.info(JSON.stringify(newConfig))
                // set new config for mediator
                config = newConfig

                // we can act on the new config received from the OpenHIM here
                winston.info(config)
              })
            }
            callback(server)
          })
        }
      })
    })
  } else {
    // default to config from mediator registration
    config = mediatorConfig.config
    let app = setupApp()
    const server = app.listen(port, () => callback(server))
  }
}
exports.start = start

if (!module.parent) {
  // if this script is run directly, start the server
  start(() => winston.info(`Listening on ${port}...`))
}
