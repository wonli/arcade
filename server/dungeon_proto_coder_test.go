package server

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/wonli/aqi/ws"
	"google.golang.org/protobuf/proto"
)

func TestDungeonProtoCoderDecodesAQIEnvelope(t *testing.T) {
	coder := NewDungeonProtoCoder()

	// DungeonRequest { id = "req-7", action = "dungeon.snapshot", params = "{}" }
	data := []byte{
		0x0a, 0x05, 'r', 'e', 'q', '-', '7',
		0x12, 0x10, 'd', 'u', 'n', 'g', 'e', 'o', 'n', '.', 's', 'n', 'a', 'p', 's', 'h', 'o', 't',
		0x1a, 0x02, '{', '}',
	}

	req, err := coder.Decode(data)
	require.NoError(t, err)
	require.Equal(t, "req-7", req.Id)
	require.Equal(t, "dungeon.snapshot", req.Action)
	require.Equal(t, []byte("{}"), req.Params)
}

func TestDungeonProtoCoderBindsSnapshotAndEncodesRelay(t *testing.T) {
	coder := NewDungeonProtoCoder()
	params, err := proto.Marshal(&DungeonSnapshotRequest{
		RoomId: "ABC123",
		Snapshot: &DungeonSnapshot{
			X:      125.5,
			Y:      48.25,
			Hp:     72,
			Moving: true,
		},
	})
	require.NoError(t, err)

	var request DungeonSnapshotRequest
	require.NoError(t, coder.Bind(params, &request))
	require.Equal(t, "ABC123", request.GetRoomId())
	require.Equal(t, float32(125.5), request.GetSnapshot().GetX())
	require.Equal(t, int32(72), request.GetSnapshot().GetHp())

	encoded, err := coder.Encode(&ws.Action{
		Action: "dungeon.snapshot",
		Data: &DungeonSnapshotRelay{
			PlayerId: "guest",
			Snapshot: request.GetSnapshot(),
		},
	})
	require.NoError(t, err)

	var response DungeonResponse
	require.NoError(t, proto.Unmarshal(encoded, &response))
	require.Equal(t, "dungeon.snapshot", response.GetAction())
	var relay DungeonSnapshotRelay
	require.NoError(t, proto.Unmarshal(response.GetData(), &relay))
	require.Equal(t, "guest", relay.GetPlayerId())
	require.True(t, relay.GetSnapshot().GetMoving())

	ack, err := coder.Encode(&ws.Action{Action: "dungeon.snapshot", Id: "req-7", Data: ws.H{"ok": true}})
	require.NoError(t, err)
	var ackResponse DungeonResponse
	require.NoError(t, proto.Unmarshal(ack, &ackResponse))
	require.Equal(t, "req-7", ackResponse.GetId())
	require.Empty(t, ackResponse.GetData())
}
