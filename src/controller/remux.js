import * as debug from '../util/debug';
import { MP4 } from '../util/mp4-generator.js';
import { AACParser } from '../parsers/aac.js';
import { OpusParser } from '../parsers/opus.js';
import { AACRemuxer } from '../remuxer/aac.js';
import { OpusRemuxer } from '../remuxer/opus.js';
import { H264Remuxer } from '../remuxer/h264.js';
import { appendByteArray, secToTime } from '../util/utils.js';
import Event from '../util/event';

export default class RemuxController extends Event {

    constructor(streaming, mp4Type) {
        super('remuxer');
        this.initialized = false;
        this.trackTypes = [];
        this.tracks = {};
        this.mediaDuration = streaming ? Infinity : 1000;
        this.mp4Type = mp4Type;
    }

    addTrack(type, audioCodec) {
        if (type === 'video' || type === 'both') {
            this.tracks.video = new H264Remuxer();
            this.trackTypes.push('video');
        }
        if (type === 'audio' || type === 'both') {
            if (audioCodec === AACParser.codec) {
                this.tracks.audio = new AACRemuxer();
                this.trackTypes.push('audio');
            } else if (audioCodec === OpusParser.codec) {
                this.tracks.audio = new OpusRemuxer();
                this.trackTypes.push('audio');
            } else {
                debug.error('Unknown audio codev audioCodec');
            }
        }
    }

    reset() {
        for (let type of this.trackTypes) {
            this.tracks[type].resetTrack();
        }
        this.initialized = false;
    }

    destroy() {
        this.tracks = {};
        this.offAll();
    }

    flush() {
        if (this.mp4Type === 'fragmented' || this.mp4Type === 'combined') {
            if (!this.initialized) {
                if (this.isReady()) {
                    this.dispatch('ready');

                    if (this.mp4Type === 'fragmented') {
                        for (let type of this.trackTypes) { 
                            let track = this.tracks[type];
                            let data = {
                                type: type,
                                payload: MP4.initSegment([track.mp4track], this.mediaDuration, track.mp4track.timescale),
                            };
                            this.dispatch('buffer', data);
                        }
                    } else {
                        let allTracks = [];
                        for (let type of this.trackTypes) { 
                            let track = this.tracks[type];
                            allTracks.push(track.mp4track);
                        }
                        let data = {
                            type: 'both',
                            payload: MP4.initSegment(allTracks, this.mediaDuration, allTracks[0].timescale),
                        };
                        this.dispatch('buffer', data);
                    }
                    debug.log('Initial segment generated.');
                    this.initialized = true;
                }
            } else {
                for (let type of this.trackTypes) {
                    let track = this.tracks[type];
                    let pay = track.getPayload();
                    if (pay && pay.byteLength) {
                        const moof = MP4.moof(track.seq, track.dts, track.mp4track);
                        const mdat = MP4.mdat(pay);
                        let payload = appendByteArray(moof, mdat);
                        let data = {
                            type: type,
                            payload: payload,
                            dts: track.dts
                        };
                        this.dispatch('buffer', data);
                        let duration = secToTime(track.dts / 1000);
                        debug.log(`put segment (${type}): ${track.seq} dts: ${track.dts} samples: ${track.mp4track.samples.length} second: ${duration}`);
                        track.flush();
                    }
                }
            }
        } else if (this.mp4Type === 'single') {
            let allTracks = [];
            for (let type of this.trackTypes) {
                allTracks.push(this.tracks[type].mp4track);
            }

            var trackPayload;
            var payload;
            
            let initSegment = MP4.initSegmentMin(
                allTracks,
                this.mediaDuration,
                allTracks[0].timescale);

            for (let type of this.trackTypes) {
                let track = this.tracks[type];

                trackPayload = MP4.mdat(track.getPayload());
                if (!payload) {
                    payload = trackPayload;
                } else {
                    payload = appendByteArray(payload, trackPayload);
                }
            }

            let moov = MP4.moov(allTracks, this.mediaDuration, allTracks[0].timescale);
            let data = {
                payload: appendByteArray(
                    initSegment,
                    payload,
                    moov)
            };

            this.dispatch('buffer', data);
        } else {
            debug.error('Unknown mp4 type ' + this.mp4Type);
        }
    }

    isReady() {
        for (let type of this.trackTypes) {
            if (!this.tracks[type].readyToDecode || !this.tracks[type].samples.length) return false;
        }
        return true;
    }

    remux(data) {
        for (let type of this.trackTypes) {
            let samples = data[type];
            if (type === 'audio' && this.tracks.video && !this.tracks.video.readyToDecode) continue; /* if video is present, don't add audio until video get ready */
            if (samples.length > 0) {
                this.tracks[type].remux(samples);
            }
        }
        this.flush();
    }
}
