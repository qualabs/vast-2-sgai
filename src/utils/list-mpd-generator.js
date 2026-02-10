
const DASH_MIN_BUFFER_TIME = "PT1S";
const DASH_RESOLUTION_TIME_OFFSET = "10";
const EVENT_STREAM_SCHEME_URI = "urn:mpeg:dash:event:callback:2015";
const EVENT_STREAM_TIMESCALE = 1000;
const EVENT_STREAM_VALUE = "1";

// Only time-based events (not user interaction events like mute, pause, etc.)
const TIME_BASED_EVENTS = ["start", "firstQuartile", "midpoint", "thirdQuartile", "complete", "progress", "impression"];

/**
 * Generates an EventStream XML string with VAST tracking events using DASH callback scheme
 * @param {Array} trackingEvents - Array of tracking events from AdCreativeSignalingMapper
 * @returns {string} EventStream XML string
 */
function generateEventStream(trackingEvents) {
  if (!trackingEvents || trackingEvents.length === 0) {
    return "";
  }

  // Filter only time-based events
  const timeBasedTrackingEvents = trackingEvents.filter(
    (event) => TIME_BASED_EVENTS.includes(event.type)
  );

  if (timeBasedTrackingEvents.length === 0) {
    return "";
  }

  let eventStreamXml = "    <EventStream schemeIdUri=\"" + EVENT_STREAM_SCHEME_URI + "\" timescale=\"" + EVENT_STREAM_TIMESCALE + "\" value=\"" + EVENT_STREAM_VALUE + "\">\n";

  timeBasedTrackingEvents.forEach((event) => {
    const presentationTime = Math.round((event.offset || 0) * EVENT_STREAM_TIMESCALE);

    // Create one Event element per URL
    event.urls.forEach((url) => {
      eventStreamXml += "      <Event presentationTime=\"" + presentationTime + "\" id=\"" + event.type + "\">\n";
      eventStreamXml += "        " + url + "\n";
      eventStreamXml += "      </Event>\n";
    });
  });

  eventStreamXml += "    </EventStream>\n";
  return eventStreamXml;
}

function getListMPD(ads) {
  const publishTime = new Date().toISOString(); // Current publish time
    
  // Initialize MPD XML structure
  let mpdXml = `<?xml version="1.0" encoding="UTF-8"?>
  <MPD xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns="urn:mpeg:dash:schema:mpd:2011"
    xsi:schemaLocation="urn:mpeg:dash:schema:mpd:2011 DASH-MPD.xsd"
    type="list" minBufferTime="${DASH_MIN_BUFFER_TIME}"
    profiles="urn:mpeg:dash:profile:list:2024"
    publishTime="${publishTime}">

  <ServiceDescription>
    <ClientDataReporting>
      <CMCDParameters version="2" keys="sid cid" contentID="vast2sgai-listmpd-cmcdv2" sessionID="vast2sgai-listmpd-cmcdv2" includeInRequests='segment' schemeIdUri="urn:mpeg:dash:cta-5004:2023">
      <ReportingTargets>
        <EventTarget 
          url="https://collector-gcloud-function-560723680185.us-east1.run.app/cmcd/response-mode"
          keys="sid e cid cen ts"
          events="ce" 
          batchSize="1" />
      </ReportingTargets>
      </CMCDParameters>
    </ClientDataReporting>
  </ServiceDescription>\n`;
  
  // Generate Period and ImportedMPD elements
  ads.forEach((ad, index) => {
    const earliestResolutionTimeOffset = index === 0 ? 0 : DASH_RESOLUTION_TIME_OFFSET;
    const eventStream = ad.trackingEvents ? generateEventStream(ad.trackingEvents) : "";

    mpdXml += "  <Period id=\"" + (index + 1) + "\" duration=\"PT" + ad.duration + "S\">\n";
    mpdXml += eventStream;
    mpdXml += "    <ImportedMPD uri=\"" + ad.fileURL + "\" earliestResolutionTimeOffset=\"" + earliestResolutionTimeOffset + "\"/>\n";
    mpdXml += "  </Period>\n";
  });
  
  // Close MPD element
  mpdXml += "</MPD>";
  return mpdXml;
};

module.exports = getListMPD;