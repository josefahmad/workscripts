/*
 * Based on http://github.com/kaloianm/workscripts/blob/3485b75d2aad95181f456e545fa334b671a120a8/ctools/auto_merge_chunks.js
 */

'use strict';
(() => {
    const NS = 'sem.cfeBackbridgeEffect';
    const MAX_CHUNKS_PER_MERGE = 1000;

    /* ============= DO NOT MODIFY NEXT LINES ===================== */

    function logLine(str) {
        print('[AUTO-MERGER] ' + str);
    }

    logLine('   Auto merging collection: ' + NS);
    logLine('   Max chunks to squash per merge request: ' + MAX_CHUNKS_PER_MERGE);
    print();

    const config = db.getSiblingDB('config');

    const chunksPerShard = {};
    config.shards.find().toArray().forEach(shard => {
        chunksPerShard[shard._id] = 0;
    });

    const collectionDoc = config.collections.findOne({_id: NS});
    if (!collectionDoc) {
        logLine("ERROR: Could not find sharded collection \'" + NS + "\'");
        return;
    }

    const totalNumChunks = config.chunks.countDocuments({ns: NS});
    logLine('Total number of chunks before merging: ' + totalNumChunks);

    const chunks = config.chunks.find({ns: NS}).sort({min: 1}).noCursorTimeout();

    var chunksToMerge = [];
    var numChunksScanned = 0;
    var numRangesMerged = 0;
    var numChunksMerged = 0;

    function issueMergeRequest() {
        assert(chunksToMerge.length > 0);

        const shard = chunksToMerge[0].shard;
        chunksPerShard[shard] += 1;

        if (chunksToMerge.length > 1) {

            numRangesMerged++;
            numChunksMerged = numChunksMerged + (chunksToMerge.length - 1);
        }
        chunksToMerge = [];
    }

    while (chunks.hasNext()) {
        var chunk = chunks.next();

        numChunksScanned++;

        if (chunksToMerge.length == MAX_CHUNKS_PER_MERGE ||
            (chunksToMerge.length > 0 &&
             chunksToMerge[chunksToMerge.length - 1].shard != chunk.shard)) {
            issueMergeRequest();
        }

        chunksToMerge.push(chunk);
    }

    issueMergeRequest();

    print();
    logLine("* Completed *");
    logLine('Total chunks processed: ' + numChunksScanned);
    logLine('Total chunks merged: ' + numChunksMerged);
    logLine('Total merge operations: ' + numRangesMerged);
    logLine('Chunks merged per shard breakdown:');
    Object.keys(chunksPerShard).forEach(shardId => {
        logLine('  Shard ' + shardId + ': ' + chunksPerShard[shardId]);
    });
    const totalChunksPerShard = Object.values(chunksPerShard).reduce((sum, val) => sum + val, 0);
    logLine('Total resulting chunks: ' + totalChunksPerShard);

})()

