export function dungeonSceneReady(scene) {
  return Boolean(scene?.player && scene.playerState && scene.playerBar && scene.keys)
}
