$(document).ready(function() {
    var isFlash = false;
    var bitmovinPlayer = bitmovin.player("playerArea");

    // choose the asset based on DRM capabilities
    bitmovinPlayer.getSupportedDRM().then(function(drmSystem) {
        var asset;
        var drmType;

        if (drmSystem.find(function(element) { return element.indexOf("apple") > -1 })) {
            asset = "hard_day_hls_fp"
            drmType = "Fairplay HLS"
        } else if (drmSystem.find(function(element) { return element.indexOf("widevine") > -1 })) {
            asset = "mon_pop_dash_wv_pr"
            drmType = "Widevine Dash"
        } else if (drmSystem.find(function(element) { return element.indexOf("playready") > -1 })) {
            asset = "mon_pop_dash_wv_pr"
            drmType = "PlayReady Dash"
        } else {
            asset = "hls_wv_pt_flash"
            drmType = "Flash Primetime HLS"
            isFlash = true;
        }

        log("Using <b>" + drmType + "</b>");

        $.getJSON("./assets/" + asset + "_bit.json", function(json) {
            if (drmSystem.find(function(element) { return element.indexOf("apple") > -1 })) {
                conf = configureFairplay(json)
            } else if(drmSystem.find(function(element) { return element.indexOf("playready") > -1 })) {
                conf = configurePlayready(json)
                console.log("configurations used ", conf)
            } else {
                conf = json
            }

            loadVideoBitmovin(conf, bitmovinPlayer)
        });
    })

    // load the player
    function loadVideoBitmovin(conf, player) {
        conf.logs = {
            level: bitmovin.player.LOGLEVEL.DEBUG
        }

        // basic set up
        conf.key = "074e66f3-f9e3-49ff-8c99-5be6fb745551"
        conf.style = {
            "width": "800px"
        }

        // adjust the bitrate (min, max, starting)
        conf.adaptation = {
            desktop: {
                bitrates: {
                    "minSelectableVideoBitrate": "800kbps",
                    "maxSelectableVideoBitrate": "Infinity"
                },
                startupBitrate: '2000000'
            }
        }
        conf.adaptation.mobile = conf.adaptation.desktop;

        // set event listeners
        conf.events = {
            onReady: function(data) {
                log("[onReady] player type: <b>" + player.getPlayerType() + "</b>")
            },
            onPlaying: function(data) {
                log("[onPlaying]");
            },
            onVideoPlaybackQualityChanged: function(data) {
                log("[bitrateChanged] new bitrate: " + data.targetQuality.bitrate)
            },
            onError: function(data) {
                log("[onError] code: " + data.code + ", message:" + data.message);
            }
        }

        // player success handler
        var onSuccess = function(playerInstance) {
            document.getElementById("flashMsg").style.display = "none"
            log('Successfully created Bitmovin Player instance');
        };

        // player failure handler
        var onFailure = function(reason) {
            document.getElementById("flashMsg").style.display = "inherit"
            log('Error while creating Bitmovin Player instance');
        }

        var conviva = new bitmovin.player.analytics.ConvivaAnalytics(player, "8a941d3b161c486d426c0a359d9d39bae51186b5", {
            applicationName: "Filmstruck - Bitmovin Test Page",
            gatewayUrl: "//turner-test.testonly.conviva.com",
            viewerId: "test123456"
        })
        
        if (isFlash) {
            // add flash specific configurations
            configureAccessDrm(conf);
            player.setup(conf, 'native-flash.hls').then(onSuccess, onFailure);
        } else {
            console.log("configs ", conf)
            player.setup(conf).then(onSuccess, onFailure);
        }
    }

    function configurePlayready(conf) {
        conf.network = {
            preprocessHttpResponse: function(type, request) {
                console.info(`Type ${type}`)
                if (type === 'manifest/dash') {
                    console.log("removing ac3 tracks")
                    request.body = request.body.replace(/aac/i, 'ignore');
                }

                return Promise.resolve(request);
            }
        }

        return conf
    }

    function configureAccessDrm(conf) {
        var href = window.location.href;
        var path = href.substring(0, href.lastIndexOf('/'));
        //var tokenURL = path + '/bitdash-player/httpstream_token.swf';
        var tokenURL = 'httpstream_token.swf';

        if (conf.source.drm) {
            conf.source.drm.access = {
                "tokenURL": tokenURL
            }
        }
        return conf
    }

    function configureFairplay(conf) {
        if (conf.source.drm.fairplay) {
            conf.source.drm.fairplay.prepareCertificate = function(cert) {
                return convertBase64StringToBuffer(cert);
            }

            conf.source.drm.fairplay.prepareMessage = function(event) {
                return event.message;
            }

            conf.source.drm.fairplay.prepareContentId = function(contentId) {
                return contentId.replace("skd://", "").split("/")[2];
            }

            conf.source.drm.fairplay.prepareLicense = function(license) {
                return convertBase64StringToBuffer(license);
            }
        }

        console.log("fairplay object ", conf)
        return conf
    }
});

function convertBase64StringToBuffer(base64Response) {
    var responseText = String.fromCharCode.apply(null, new Uint8Array(base64Response)).replace(/"/g, '');
    var raw = window.atob(responseText);
    var rawLength = raw.length;
    var buffer = new Uint8Array(new ArrayBuffer(rawLength));

    for (var i = 0; i < rawLength; i++) {
        buffer[i] = raw.charCodeAt(i);
    }

    return buffer;
}

function log(s) {
    var logOutput = document.getElementById("logger");
    logOutput.innerHTML = s + '<br/>' + logOutput.innerHTML;
}
