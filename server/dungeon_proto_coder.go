package server

import (
	"errors"
	"fmt"

	"github.com/wonli/aqi/ws"
	"google.golang.org/protobuf/proto"
)

// DungeonProtoCoder is the route-scoped binary coder for Dungeon's realtime
// data plane. The AQI envelope remains generic; route payloads are protobuf
// messages defined in proto/dungeon.proto.
type DungeonProtoCoder struct{}

func NewDungeonProtoCoder() DungeonProtoCoder { return DungeonProtoCoder{} }

func (DungeonProtoCoder) Decode(data []byte) (*ws.Request, error) {
	var request DungeonRequest
	if err := proto.Unmarshal(data, &request); err != nil {
		return nil, fmt.Errorf("decode dungeon request: %w", err)
	}
	if request.GetAction() == "" {
		return nil, errors.New("dungeon request action is required")
	}
	return &ws.Request{
		Id:     request.GetId(),
		Action: request.GetAction(),
		Params: request.GetParams(),
	}, nil
}

func (DungeonProtoCoder) Bind(data []byte, value any) error {
	message, ok := value.(proto.Message)
	if !ok {
		return errors.New("dungeon binary payload must bind to a protobuf message")
	}
	if err := proto.Unmarshal(data, message); err != nil {
		return fmt.Errorf("decode dungeon payload: %w", err)
	}
	return nil
}

func (DungeonProtoCoder) Encode(action *ws.Action) ([]byte, error) {
	if action == nil {
		return nil, errors.New("dungeon action is required")
	}

	response := &DungeonResponse{
		Code:   int32(action.Code),
		Action: action.Action,
		Id:     action.Id,
		Msg:    action.Msg,
	}

	if action.Data != nil {
		payload, ack, err := dungeonActionData(action.Action, action.Data)
		if err != nil {
			return nil, err
		}
		if !ack {
			response.Data, err = proto.Marshal(payload)
			if err != nil {
				return nil, fmt.Errorf("encode dungeon action data: %w", err)
			}
		}
	}

	data, err := proto.Marshal(response)
	if err != nil {
		return nil, fmt.Errorf("encode dungeon response: %w", err)
	}
	return data, nil
}

func dungeonActionData(action string, data any) (proto.Message, bool, error) {
	switch action {
	case "dungeon.snapshot":
		if snapshot, ok := data.(*DungeonSnapshotRelay); ok {
			return snapshot, false, nil
		}
		if snapshot, ok := data.(DungeonSnapshotRelay); ok {
			return &snapshot, false, nil
		}
		return nil, true, nil
	case "dungeon.command":
		if command, ok := data.(*DungeonCommandRelay); ok {
			return command, false, nil
		}
		if command, ok := data.(DungeonCommandRelay); ok {
			return &command, false, nil
		}
		return nil, true, nil
	default:
		return nil, false, fmt.Errorf("unsupported dungeon binary action %q", action)
	}
}
