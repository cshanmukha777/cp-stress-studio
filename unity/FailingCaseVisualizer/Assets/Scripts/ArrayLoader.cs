using System.Collections.Generic;
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
    public GameObject pedestalPrefab;
    public Material greenMaterial;
    public Material redMaterial;
    public Material neutralMaterial;
    public Color pedestalColor = new Color(0.2f, 0.3f, 0.4f);
    public Camera[] cameras;
    public float spacing = 1.5f;
    public TextAsset caseFile;

    CaseData data;
    List<GameObject> bars = new List<GameObject>();
    List<GameObject> pedestals = new List<GameObject>();
    HashSet<GameObject> wrongBars = new HashSet<GameObject>();
    int currentView = 2;
    int currentCamera = 0;
    bool gameActive = false;
    float timeLeft = 0f;
    int score = 0;
    string message = "";

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
        data = JsonUtility.FromJson<CaseData>(caseFile.text);
    }

    void Update()
    {
        if (Input.GetKeyDown(KeyCode.Alpha1)) ShowView(0);
        if (Input.GetKeyDown(KeyCode.Alpha2)) ShowView(1);
        if (Input.GetKeyDown(KeyCode.Alpha3)) ShowView(2);
        if (Input.GetKeyDown(KeyCode.C)) NextCamera();

        if (gameActive)
        {
            timeLeft -= Time.deltaTime;
            if (timeLeft <= 0f)
            {
                EndGame("Time up!");
            }
            else if (Input.GetMouseButtonDown(0))
            {
                ClickBar();
            }
        }
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
        if (GUI.Button(new Rect(10, 210, 140, 35), "Start Game")) StartGame();

        GUI.Label(new Rect(Screen.width - 320, 10, 310, 25), "Score: " + score + "   Time: " + Mathf.CeilToInt(Mathf.Max(timeLeft, 0f)));
        GUI.Label(new Rect(Screen.width - 320, 35, 310, 25), "Expected: " + string.Join(" ", data.expected));
        GUI.Label(new Rect(Screen.width - 320, 60, 310, 25), message);
    }

    void StartGame()
    {
        currentView = 2;
        ClearBars();
        score = 0;
        timeLeft = 30f;
        message = "Find the wrong bars!";
        gameActive = true;
        BuildBars(data.actual, neutralMaterial, false);
        for (int i = 0; i < data.actual.Length; i++)
        {
            if (data.actual[i] != data.expected[i])
            {
                wrongBars.Add(bars[i]);
            }
        }
    }

    void ClickBar()
    {
        Ray ray = Camera.main.ScreenPointToRay(Input.mousePosition);
        RaycastHit hit;
        if (!Physics.Raycast(ray, out hit)) return;

        GameObject clicked = hit.collider.gameObject;
        if (wrongBars.Contains(clicked))
        {
            score += 1;
            wrongBars.Remove(clicked);
            clicked.GetComponent<Renderer>().material = redMaterial;
            Destroy(Instantiate(burstPrefab, clicked.transform.position, Quaternion.identity), 2f);
            if (wrongBars.Count == 0)
            {
                EndGame("You found all wrong bars!");
            }
        }
        else if (bars.Contains(clicked))
        {
            score -= 1;
            message = "Wrong click! -1";
        }
    }

    void EndGame(string text)
    {
        gameActive = false;
        message = text + " Final score: " + score;
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
        gameActive = false;
        message = "";
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
        foreach (GameObject pedestal in pedestals)
        {
            Destroy(pedestal);
        }
        bars.Clear();
        pedestals.Clear();
        wrongBars.Clear();
    }

    void BuildBars(int[] values, Material baseMaterial, bool compare)
    {
        for (int i = 0; i < values.Length; i++)
        {
            GameObject pedestal = GameObject.CreatePrimitive(PrimitiveType.Cube);
            pedestal.transform.localScale = new Vector3(1.4f, 0.2f, 1.4f);
            pedestal.transform.position = new Vector3(i * spacing, 0.1f, 0f);
            Renderer pr = pedestal.GetComponent<Renderer>();
            pr.material = new Material(neutralMaterial);
            pr.material.color = pedestalColor;
            pedestals.Add(pedestal);

            GameObject bar = Instantiate(barPrefab);
            bars.Add(bar);
            float height = values[i];
            bar.transform.localScale = new Vector3(1f, height, 1f);
            bar.transform.position = new Vector3(i * spacing, 0.2f + height / 2f, 0f);

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