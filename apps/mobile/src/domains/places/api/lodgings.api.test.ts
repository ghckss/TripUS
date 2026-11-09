import { deletePlace, listPlaces, savePlace, updatePlace } from "./places.api";
import { savePrimaryLodging } from "./lodgings.api";

jest.mock("./places.api", () => ({
  deletePlace: jest.fn(),
  listPlaces: jest.fn(),
  savePlace: jest.fn(),
  updatePlace: jest.fn(),
}));

const mockDeletePlace = jest.mocked(deletePlace);
const mockListPlaces = jest.mocked(listPlaces);
const mockSavePlace = jest.mocked(savePlace);
const mockUpdatePlace = jest.mocked(updatePlace);

describe("savePrimaryLodging", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a lodging when the trip does not have one", async () => {
    mockListPlaces.mockResolvedValue([]);
    mockSavePlace.mockResolvedValue({
      status: "created",
      place: { id: "lodging-1", name: "서울 호텔" },
    } as never);

    await savePrimaryLodging("trip-1", { name: " 서울 호텔 ", address: " 서울 중구 " });

    expect(mockSavePlace).toHaveBeenCalledWith("trip-1", {
      address: "서울 중구",
      name: "서울 호텔",
      preference: "want_to_visit",
      tag: "lodging",
      isPrimaryLodging: true,
    });
  });

  it("updates or removes the existing primary lodging", async () => {
    mockListPlaces.mockResolvedValue([{ id: "lodging-1", name: "기존 호텔", tag: "lodging", isPrimaryLodging: true }] as never);

    await savePrimaryLodging("trip-1", { name: "새 호텔", address: "새 주소" });
    expect(mockUpdatePlace).toHaveBeenCalledWith("trip-1", "lodging-1", {
      address: "새 주소",
      name: "새 호텔",
      tag: "lodging",
      isPrimaryLodging: true,
    });

    await savePrimaryLodging("trip-1", { name: "", address: "" });
    expect(mockDeletePlace).toHaveBeenCalledWith("trip-1", "lodging-1");
  });
});
