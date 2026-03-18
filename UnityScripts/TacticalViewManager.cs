using UnityEngine;

public class TacticalViewManager : MonoBehaviour
{
    [SerializeField] private LocationViewStaticBatchCollector locationBatchCollector;

    [SerializeField] private TacticalRoomView tacticalRoomView;

    public void InitializeRoom()
    {
        if (tacticalRoomView == null)
        {
            return;
        }

        tacticalRoomView.InitializeRoom(locationBatchCollector);
    }
}
