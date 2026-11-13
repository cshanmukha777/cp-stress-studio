using System.IO;
using UnityEngine;

[System.Serializable]
public class CaseData
{
    public string type;
    public int[] input;
    public int[] expected;
    public int[] actual;
}

public class ArrayLoader : MonoBehaviour
{
    public GameObject barPrefab;
    public GameObject burstPrefab;
    public Material greenMaterial;
    public Material redMaterial;
    public float spacing = 1.5f;

    void Start()
    {
        string path = Path.Combine(Application.streamingAssetsPath, "failing_case.json");
        string json = File.ReadAllText(path);
        CaseData data = JsonUtility.FromJson<CaseData>(json);
        ShowBars(data);
    }

    void ShowBars(CaseData data)
    {
        for (int i = 0; i < data.actual.Length; i++)
        {
            GameObject bar = Instantiate(barPrefab);
            float height = data.actual[i];
            bar.transform.localScale = new Vector3(1f, height, 1f);
            bar.transform.position = new Vector3(i * spacing, height / 2f, 0f);

            Renderer r = bar.GetComponent<Renderer>();
            if (data.actual[i] == data.expected[i])
            {
                r.material = greenMaterial;
            }
            else
            {
                r.material = redMaterial;
                bar.AddComponent<Rigidbody>();
                bar.transform.position += new Vector3(0f, 3f, 0f);
                Instantiate(burstPrefab, bar.transform.position, Quaternion.identity);
            }
        }
    }
}
