/* eslint-disable no-plusplus */
process.env.NODE_ENV = 'production';

require('../config/env');

const { API, cond, and } = require('space-api');
const axios = require('axios');
const fetch = require('isomorphic-fetch');
const moment = require('moment');
const findIndex = require('lodash/findIndex');

const generateId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const api = new API(
  process.env.REACT_APP_PROJECT_ID,
  process.env.REACT_APP_SPACE_CLOUD_URL
);
const db = api.Mongo();

console.log(`[${new Date().toString()}] checking frequency updates`);

async function run() {
  // so here we get all of the signatories in the cms
  // and loop through them
  const sigResp = await db.get('signatories').apply();
  const sigData = sigResp.data.result;

  for (let sigInd = 0; sigInd < sigData.length; sigInd++) {
    const signatory = sigData[sigInd];
    if (signatory.regPubId && signatory.regPubId.length > 0) {
      // then we request the json file containing the
      // signatories frequency data
      const urlz = `http://publishingstats.iatistandard.org/stats/gitaggregate-publisher-dated/${signatory.regPubId}/most_recent_transaction_date.json`;

      fetch(urlz)
        .then(response => response.json())
        .then(async jsonData => {
          let freqData = jsonData;

          // here we sort the date object by date keys
          freqData = Object.keys(freqData)
            .sort()
            .reduce((accumulator, currentValue) => {
              accumulator[currentValue] = freqData[currentValue];
              return accumulator;
            }, {});

          // let latestDate = ;
          // so here we get the latest item from our frequency data
          // for the current signatory
          let latestFrequency = await db
            .get('frequency')
            .where(cond('sig_ref', '==', signatory.IATIOrgRef))
            .sort('actual_date')
            .apply();

          let prevTransDate = moment('1000-01-01');
          freqData = Object.entries(freqData);

          if (latestFrequency.data.result.length > 0) {
            latestFrequency =
              latestFrequency.data.result[
                latestFrequency.data.result.length - 1
              ];
            prevTransDate = moment(
              latestFrequency.last_trans_date.substring(0, 10)
            );
            const currDateIndex = findIndex(
              freqData,
              item => item[0] === latestFrequency.actual_date
            );
            if (currDateIndex === -1) {
              console.log(
                `[${new Date()}] - date item not found, please recheck code and data`
              );
            } else {
              freqData = freqData.slice(currDateIndex);
            }
          }

          for (let i = 0; i < freqData.length; i++) {
            const freqItem = freqData[i];

            if (freqItem[0] && freqItem[1]) {
              // date when a transaction was updated
              const updDate = freqItem[0];
              // date of transaction stated in the
              // transaction element
              const transDate = moment(freqItem[1]);
              // here we check if a difference was spotted
              // between transaction dates
              if (transDate.isAfter(prevTransDate)) {
                // hooray! we found an update
                // for 'upDate' date
                prevTransDate = transDate;
                // now we need to cross check this with the datastore
                // to make sure that there's at least one
                // HUMANITARIAN activity with the found transaction date
                // for the current signatory organisation
                const humRes = await axios.get(
                  `${process.env.REACT_APP_DS_API}/search/activity/`,
                  {
                    params: {
                      q: `reporting_org_ref:${signatory.IATIOrgRef} AND
                        transaction_date_iso_date:[${
                          freqItem[1]
                        }T00:00:00Z TO ${freqItem[1]}T23:59:59Z]
                        AND (humanitarian:1 OR transaction_humanitarian:1 OR 
                        (-(-sector_vocabulary:1 OR sector_vocabulary:*) AND 
                        (sector_code:[70000 TO 79999] OR sector_code:[93010 TO 93018])) OR 
                        (-(-transaction_sector_vocabulary:1 OR transaction_sector_vocabulary:*) AND 
                        (transaction_sector_code:[70000 TO 79999] OR
                         transaction_sector_code:[93010 TO 93018])))`,
                      rows: '0',
                    },
                  }
                );

                if (humRes.data.response.numFound > 0) {
                  // and hooray, its a humanitarian update
                  // so we can insert this update as a new item
                  // OR we can increase the update value if an item
                  // with the year and month already exists
                  // and the organisations ref
                  const monthDate = updDate.substring(0, 7);
                  const freqRes = await db
                    .getOne('frequency')
                    .where(
                      and(
                        cond('month_date', '==', monthDate),
                        cond('sig_ref', '==', signatory.IATIOrgRef)
                      )
                    )
                    .apply();

                  if (freqRes.status === 200) {
                    const frequency = freqRes.data.result;
                    // so if month frequency is found we increase
                    // the frequency value
                    await db
                      .updateOne('frequency')
                      .where(cond('_id', '==', frequency._id))
                      .set({
                        last_trans_date: transDate.format(),
                        actual_date: updDate,
                        updates_for_month: frequency.updates_for_month + 1,
                      })
                      .apply();
                    console.log(
                      `[${new Date().toString()}]increasing updates for signatory`,
                      signatory.IATIOrgRef
                    );
                    console.log('sig name', signatory.pubName);
                  } else {
                    // otherwise we add a new frequency item
                    console.log(
                      `[${new Date().toString()}]adding new month updates for signatory`,
                      signatory.IATIOrgRef
                    );
                    console.log('sig name', signatory.pubName);

                    await db
                      .insert('frequency')
                      .doc({
                        _id: generateId(),
                        sig_id: signatory._id,
                        sig_ref: signatory.IATIOrgRef,
                        sig_short_name: signatory.regPubId,
                        sig_long_name: signatory.pubName,
                        last_trans_date: transDate.format(),
                        actual_date: updDate,
                        month_date: monthDate,
                        updates_for_month: 1,
                      })
                      .apply();
                  }
                }
              }
            }
          }
        })
        .catch(error => {
          // handle your errors here
          console.log('error', error);
        });
    }
  }
}

run();
