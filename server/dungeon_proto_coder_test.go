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
		Snapshot: &DungeonPresenceSnapshot{
			X:      proto.Float32(125.5),
			Y:      proto.Float32(48.25),
			Moving: true,
		},
		PlayerState: &DungeonPlayerState{
			Hp: proto.Int32(72),
			Equipment: &DungeonEquipment{
				Weapon: &DungeonWeapon{
					Id:      "blood-reaver",
					Type:    "weapon.blood_reaver",
					Damage:  proto.Float64(13),
					Affixes: []*DungeonWeaponAffix{{Id: "power", Value: proto.Float64(0.2)}},
				},
			},
			Modifiers: &DungeonModifierSet{Layers: []*DungeonModifierLayer{{
				Name: "equipment",
				Values: []*DungeonModifierEntry{{
					Key:   "attackSpeed",
					Value: &DungeonModifierValue{Value: &DungeonModifierValue_NumberValue{NumberValue: 0.12}},
				}},
			}}},
		},
	})
	require.NoError(t, err)

	var request DungeonSnapshotRequest
	require.NoError(t, coder.Bind(params, &request))
	require.Equal(t, "ABC123", request.GetRoomId())
	require.Equal(t, float32(125.5), request.GetSnapshot().GetX())
	require.Equal(t, int32(72), request.GetPlayerState().GetHp())
	require.Equal(t, "blood-reaver", request.GetPlayerState().GetEquipment().GetWeapon().GetId())
	require.Equal(t, "weapon.blood_reaver", request.GetPlayerState().GetEquipment().GetWeapon().GetType())
	require.Equal(t, 0.2, request.GetPlayerState().GetEquipment().GetWeapon().GetAffixes()[0].GetValue())
	require.Equal(t, "equipment", request.GetPlayerState().GetModifiers().GetLayers()[0].GetName())
	require.Equal(t, "attackSpeed", request.GetPlayerState().GetModifiers().GetLayers()[0].GetValues()[0].GetKey())

	encoded, err := coder.Encode(&ws.Action{
		Action: "dungeon.snapshot",
		Data: &DungeonSnapshotRelay{
			PlayerId:    "guest",
			Snapshot:    request.GetSnapshot(),
			PlayerState: request.GetPlayerState(),
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
	require.Equal(t, request.GetPlayerState().GetEquipment().GetWeapon().GetId(), relay.GetPlayerState().GetEquipment().GetWeapon().GetId())
	require.Equal(t, request.GetPlayerState().GetEquipment().GetWeapon().GetAffixes()[0].GetValue(), relay.GetPlayerState().GetEquipment().GetWeapon().GetAffixes()[0].GetValue())

	ack, err := coder.Encode(&ws.Action{Action: "dungeon.snapshot", Id: "req-7", Data: ws.H{"ok": true}})
	require.NoError(t, err)
	var ackResponse DungeonResponse
	require.NoError(t, proto.Unmarshal(ack, &ackResponse))
	require.Equal(t, "req-7", ackResponse.GetId())
	require.Empty(t, ackResponse.GetData())
}

func TestDungeonProtoCoderDropsUnknownPlayerStateFields(t *testing.T) {
	coder := NewDungeonProtoCoder()

	// DungeonPlayerState field 15 used to be state_json. It is now unknown and
	// must not survive binding into a relay message.
	legacyJSON := []byte(`{"hp":72}`)
	state := append([]byte{0x08, 0x48, 0x7a, byte(len(legacyJSON))}, legacyJSON...)
	params := append([]byte{0x1a, byte(len(state))}, state...)

	var request DungeonSnapshotRequest
	require.NoError(t, coder.Bind(params, &request))
	require.Equal(t, int32(72), request.GetPlayerState().GetHp())
	require.Empty(t, request.GetPlayerState().ProtoReflect().GetUnknown())
}
