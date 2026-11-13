using System.Collections.Generic;
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
    public Material neutralMaterial;
    public Camera[] cameras;
    public float spacing = 1.5f;

    CaseData data;
    List<GameObject> bars = new List<GameObject>();
    int currentView = 2;
    int currentCamera = 0;

    void Start()
    {
        for (int i = 0; i < cameras.Length; i++)
        {
            cameras[i].gameObject.SetActive(i == 0);
        }
        LoadData();
        ShowView(2);
    }

    void LoadData()
    {
        string path = Path.Combine(Application.streamingAssetsPath, "failing_case.json");
        string json = File.ReadAllText(path);
        data = JsonUtility.FromJson<CaseData>(json);
    }

    void Update()
    {
        if (Input.GetKeyDown(KeyCode.Alpha1)) ShowView(0);
        if (Input.GetKeyDown(KeyCode.Alpha2)) ShowView(1);
        if (Input.GetKeyDown(KeyCode.Alpha3)) ShowView(2);
        if (Input.GetKeyDown(KeyCode.C)) NextCamera();
    }

    void OnGUI()
    {
        if (GUI.Button(new Rect(10, 10, 140, 35), "Input (1)")) ShowView(0);
        if (GUI.Button(new Rect(10, 50, 140, 35), "Expected (2)")) ShowView(1);
        if (GUI.Button(new Rect(10, 90, 140, 35), "Actual (3)")) ShowView(2);
        if (GUI.Button(new Rect(10, 130, 140, 35), "Camera (C)")) NextCamera();
        if (GUI.Button(new Rect(10, 170, 140, 35), "Reload"))
        {
            LoadData();
            ShowView(currentView);
        }
    }

    void NextCamera()
    {
        cameras[currentCamera].gameObject.SetActive(false);
        currentCamera = (currentCamera + 1) % cameras.Length;
        cameras[currentCamera].gameObject.SetActive(true);
    }

    void ShowView(int view)
    {
        currentView = view;
        ClearBars();
        if (view == 0) BuildBars(data.input, neutralMaterial, false);
        if (view == 1) BuildBars(data.expected, greenMaterial, false);
        if (view == 2) BuildBars(data.actual, greenMaterial, true);
    }

    void ClearBars()
    {
        foreach (GameObject bar in bars)
        {
            Destroy(bar);
        }
        bars.Clear();
    }

    void BuildBars(int[] values, Material baseMaterial, bool compare)
    {
        for (int i = 0; i < values.Length; i++)
        {
            GameObject bar = Instantiate(barPrefab);
            bars.Add(bar);
            float height = values[i];
            bar.transform.localScale = new Vector3(1f, height, 1f);
            bar.transform.position = new Vector3(i * spacing, height / 2f, 0f);

            Renderer r = bar.GetComponent<Renderer>();
            r.material = baseMaterial;

            if (compare && data.actual[i] != data.expected[i])
            {
                r.material = redMaterial;
                bar.AddComponent<Rigidbody>();
                bar.transform.position += new Vector3(0f, 3f, 0f);
                GameObject burst = Instantiate(burstPrefab, bar.transform.position, Quaternion.identity);
                Destroy(burst, 2f);
            }
        }
    }
}