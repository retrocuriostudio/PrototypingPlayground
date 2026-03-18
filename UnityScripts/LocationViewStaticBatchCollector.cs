using System.Collections.Generic;
using UnityEngine;

public class LocationViewStaticBatchCollector : MonoBehaviour
{
    [SerializeField] private Transform staticBatchRoot;

    private readonly List<GameObject> _staticCandidates = new List<GameObject>();

    public void RegisterStaticCandidate(GameObject candidate)
    {
        if (candidate == null)
        {
            Debug.LogWarning("Tried to register a null static batching candidate.");
            return;
        }

        if (!IsEligibleForStaticBatching(candidate))
        {
            Debug.LogWarning($"GameObject '{candidate.name}' is not eligible for static batching and will be skipped.", candidate);
            return;
        }

        if (_staticCandidates.Contains(candidate))
        {
            return;
        }

        _staticCandidates.Add(candidate);
    }

    public void CombineNow()
    {
        _staticCandidates.RemoveAll(candidate => candidate == null);

        if (_staticCandidates.Count == 0)
        {
            return;
        }

        var rootObject = staticBatchRoot != null ? staticBatchRoot.gameObject : gameObject;
        StaticBatchingUtility.Combine(_staticCandidates.ToArray(), rootObject);
    }

    private static bool IsEligibleForStaticBatching(GameObject candidate)
    {
        var meshFilter = candidate.GetComponent<MeshFilter>();
        var meshRenderer = candidate.GetComponent<MeshRenderer>();

        if (meshFilter == null || meshRenderer == null)
        {
            return false;
        }

        if (meshFilter.sharedMesh == null)
        {
            return false;
        }

        return meshRenderer.sharedMaterial != null;
    }
}
