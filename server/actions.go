package server

import (
	"encoding/json"
	"strings"

	"github.com/wonli/aqi/ws"
	"github.com/wonli/arcade/arcade"
	"github.com/wonli/arcade/game"
)

type Actions struct { service *arcade.Service }
func NewActions(service *arcade.Service) *Actions { return &Actions{service: service} }
func (a *Actions) Register(router ws.IRouter) {
	router.Add("arcade.login", a.login); router.Add("room.create", a.createRoom); router.Add("room.join", a.joinRoom); router.Add("room.state", a.roomState); router.Add("room.addBot", a.addBot); router.Add("room.rematch", a.rematch); router.Add("game.move", a.move); router.Add("tetris.state", a.tetrisState); router.Add("tetris.attack", a.tetrisAttack); router.Add("tetris.gameover", a.tetrisGameOver); router.Add("tetris.restart", a.tetrisRestart)
}
type loginRequest struct { PlayerID string `json:"playerId"`; SessionID string `json:"sessionId"` }
func (a *Actions) login(c *ws.Context) {
	var req loginRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.PlayerID)=="" || strings.TrimSpace(req.SessionID)=="" { c.SendCode(400,"invalid guest identity"); return }
	if err := c.Client.Hub.UserLogin(arcade.GuestUID(req.PlayerID), arcade.GuestAppID(req.SessionID), c.Client); err != nil { c.SendCode(500,err.Error()); return }
	c.Send(ws.H{"playerId":req.PlayerID,"uid":arcade.GuestUID(req.PlayerID)})
}
type roomRequest struct { RoomID string `json:"roomId"`; Name string `json:"name"` }
type createRoomRequest struct { Game string `json:"game"`; Name string `json:"name"`; Players int `json:"players"` }
func (a *Actions) createRoom(c *ws.Context) {
	playerID,ok:=currentPlayer(c); if !ok { c.SendCode(401,"guest login required"); return }
	var req createRoomRequest; if err:=c.BindingJson(&req); err!=nil { c.SendCode(400,"invalid room request"); return }
	if req.Game=="" { req.Game="gomoku" }; if req.Players==0 { req.Players=2 }
	r,err:=a.service.Create(req.Game,req.Players); if err!=nil { c.SendCode(400,err.Error()); return }
	if err:=a.service.Join(r.ID,playerID,displayName(req.Name,playerID)); err!=nil { c.SendCode(400,err.Error()); return }
	topic:=roomTopic(r.ID); c.Sub(topic); state:=r.Snapshot(); c.Send(state); c.Pub(topic,state)
}
func (a *Actions) joinRoom(c *ws.Context) {
	playerID,ok:=currentPlayer(c); if !ok { c.SendCode(401,"guest login required"); return }
	var req roomRequest; if err:=c.BindingJson(&req); err!=nil || strings.TrimSpace(req.RoomID)=="" { c.SendCode(400,"invalid room request"); return }; req.RoomID=strings.ToUpper(strings.TrimSpace(req.RoomID))
	if err:=a.service.Join(req.RoomID,playerID,displayName(req.Name,playerID)); err!=nil { c.SendCode(400,err.Error()); return }
	r,_:=a.service.Get(req.RoomID); topic:=roomTopic(req.RoomID); c.Sub(topic); state:=r.Snapshot(); c.Send(state); c.Pub(topic,state)
}
func (a *Actions) roomState(c *ws.Context) { var req roomRequest; if err:=c.BindingJson(&req); err!=nil || strings.TrimSpace(req.RoomID)=="" { c.SendCode(400,"invalid room request"); return }; req.RoomID=strings.ToUpper(strings.TrimSpace(req.RoomID)); r,ok:=a.service.Get(req.RoomID); if !ok { c.SendCode(404,"room not found"); return }; c.Send(r.Snapshot()) }
func (a *Actions) addBot(c *ws.Context) { playerID,ok:=currentPlayer(c); if !ok { c.SendCode(401,"guest login required"); return }; var req roomRequest; if err:=c.BindingJson(&req); err!=nil || strings.TrimSpace(req.RoomID)=="" { c.SendCode(400,"invalid room request"); return }; req.RoomID=strings.ToUpper(strings.TrimSpace(req.RoomID)); if err:=a.service.AddBot(req.RoomID,playerID); err!=nil { c.SendCode(400,err.Error()); return }; a.sendRoom(c,req.RoomID) }
func (a *Actions) rematch(c *ws.Context) { playerID,ok:=currentPlayer(c); if !ok { c.SendCode(401,"guest login required"); return }; var req roomRequest; if err:=c.BindingJson(&req); err!=nil || strings.TrimSpace(req.RoomID)=="" { c.SendCode(400,"invalid room request"); return }; req.RoomID=strings.ToUpper(strings.TrimSpace(req.RoomID)); if err:=a.service.Rematch(req.RoomID,playerID); err!=nil { c.SendCode(400,err.Error()); return }; a.sendRoom(c,req.RoomID) }
type moveRequest struct { RoomID string `json:"roomId"`; Move json.RawMessage `json:"move"` }
func (a *Actions) move(c *ws.Context) { playerID,ok:=currentPlayer(c); if !ok { c.SendCode(401,"guest login required"); return }; var req moveRequest; if err:=c.BindingJson(&req); err!=nil || strings.TrimSpace(req.RoomID)=="" || len(req.Move)==0 { c.SendCode(400,"invalid move"); return }; req.RoomID=strings.ToUpper(strings.TrimSpace(req.RoomID)); if err:=a.service.Move(req.RoomID,playerID,req.Move); err!=nil { c.SendCode(400,err.Error()); return }; a.sendRoom(c,req.RoomID) }
type tetrisStateRequest struct { RoomID string `json:"roomId"`; Board [][]int `json:"board"`; Score int `json:"score"`; Lines int `json:"lines"`; GameOver bool `json:"gameOver"` }
type tetrisAttackRequest struct { RoomID string `json:"roomId"`; Lines int `json:"lines"` }
func (a *Actions) tetrisState(c *ws.Context) { playerID,ok:=currentPlayer(c); if !ok { c.SendCode(401,"guest login required"); return }; var req tetrisStateRequest; if err:=c.BindingJson(&req); err!=nil || !a.canRelayTetris(req.RoomID,playerID) { c.SendCode(400,"invalid tetris state"); return }; roomID:=strings.ToUpper(strings.TrimSpace(req.RoomID)); c.Pub(roomTopic(roomID),ws.H{"type":"tetris.state","playerId":playerID,"board":req.Board,"score":req.Score,"lines":req.Lines,"gameOver":req.GameOver}); c.Send(ws.H{"ok":true}) }
func (a *Actions) tetrisAttack(c *ws.Context) { playerID,ok:=currentPlayer(c); if !ok { c.SendCode(401,"guest login required"); return }; var req tetrisAttackRequest; if err:=c.BindingJson(&req); err!=nil || req.Lines<=0 || req.Lines>8 || !a.canRelayTetris(req.RoomID,playerID) { c.SendCode(400,"invalid tetris attack"); return }; roomID:=strings.ToUpper(strings.TrimSpace(req.RoomID)); c.Pub(roomTopic(roomID),ws.H{"type":"tetris.attack","playerId":playerID,"lines":req.Lines}); c.Send(ws.H{"ok":true}) }
func (a *Actions) tetrisGameOver(c *ws.Context) { playerID,ok:=currentPlayer(c); if !ok { c.SendCode(401,"guest login required"); return }; var req roomRequest; if err:=c.BindingJson(&req); err!=nil || !a.canRelayTetris(req.RoomID,playerID) { c.SendCode(400,"invalid tetris game over"); return }; roomID:=strings.ToUpper(strings.TrimSpace(req.RoomID)); c.Pub(roomTopic(roomID),ws.H{"type":"tetris.gameover","playerId":playerID}); c.Send(ws.H{"ok":true}) }
func (a *Actions) tetrisRestart(c *ws.Context) { playerID,ok:=currentPlayer(c); if !ok { c.SendCode(401,"guest login required"); return }; var req roomRequest; if err:=c.BindingJson(&req); err!=nil || !a.canRelayTetris(req.RoomID,playerID) { c.SendCode(400,"invalid tetris restart"); return }; roomID:=strings.ToUpper(strings.TrimSpace(req.RoomID)); c.Pub(roomTopic(roomID),ws.H{"type":"tetris.restart","playerId":playerID}); c.Send(ws.H{"ok":true}) }
func (a *Actions) canRelayTetris(roomID string, playerID game.PlayerID) bool { roomID=strings.ToUpper(strings.TrimSpace(roomID)); r,ok:=a.service.Get(roomID); return ok && r.GameName=="tetris" && r.HasPlayer(playerID) }
func (a *Actions) sendRoom(c *ws.Context,roomID string) { r,ok:=a.service.Get(roomID); if !ok { c.SendCode(404,"room not found"); return }; state:=r.Snapshot(); c.Send(state); c.Pub(roomTopic(roomID),state) }
func currentPlayer(c *ws.Context) (game.PlayerID,bool) { if c==nil || c.Client==nil { return "",false }; user,_,loggedIn:=c.Client.LoginState(); if !loggedIn || user==nil { return "",false }; uid:=user.Suid; if !strings.HasPrefix(uid,"arcade:") { return "",false }; playerID:=strings.TrimPrefix(uid,"arcade:"); return game.PlayerID(playerID),playerID!="" }
func roomTopic(roomID string) string { return "room:"+strings.ToUpper(strings.TrimSpace(roomID)) }
func displayName(name string,playerID game.PlayerID) string { name=strings.TrimSpace(name); if name!="" { return name }; id:=string(playerID); if len(id)>6 { id=id[:6] }; return "PLAYER-"+strings.ToUpper(id) }
