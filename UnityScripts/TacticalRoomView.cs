using UnityEngine;

public class TacticalRoomView : MonoBehaviour
{
    [SerializeField] private GameObject _floorView;
    [SerializeField] private GameObject _wallViewManager;

    public void InitializeRoom(LocationViewStaticBatchCollector locationBatchCollector)
    {
        if (locationBatchCollector == null)
        {
            return;
        }

        locationBatchCollector.RegisterStaticCandidate(_floorView);
        locationBatchCollector.RegisterStaticCandidate(_wallViewManager);
    }
}
